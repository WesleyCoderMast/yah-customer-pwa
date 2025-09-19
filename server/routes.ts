import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailService } from "./emailService";
import { z } from "zod";
import {
  insertPaymentMethodSchema,
  insertRideSchema,
  insertYahMessageSchema,
  insertDriverReportSchema,
  insertRideCategorySchema,
  insertRideTypeSchema,
  insertCustomerSchema,
  insertRideRequestSchema,
  insertYahChatSessionSchema,
} from "@shared/schema";
import { createClient } from "@supabase/supabase-js";
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config";
import stripeRoutes from "./stripeRoutes";
import { Store } from "lucide-react";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Supabase admin client for server-side operations
  const supabaseAdmin = createClient(
    VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  );

  // Authentication routes for custom email confirmation
  app.post("/api/auth/send-confirmation-email", async (req, res) => {
    try {
      const { userId, email, name } = req.body;

      if (!userId || !email || !name) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const confirmUrl = `${req.protocol}://${req.get("host")}/email-confirmed?token=${userId}&email=${encodeURIComponent(email)}`;

      await emailService.sendConfirmationEmail(email, name, userId, confirmUrl);

      res.json({ message: "Confirmation email sent successfully" });
    } catch (error: any) {
      console.error("Failed to send confirmation email:", error);
      res.status(500).json({ message: "Failed to send confirmation email" });
    }
  });

  app.post("/api/auth/confirm-email", async (req, res) => {
    try {
      const { token, email } = req.body;

      if (!token || !email) {
        return res.status(400).json({ message: "Missing token or email" });
      }

      // Confirm the user's email with Supabase admin client
      const { data: user, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(token);

      if (userError || !user) {
        console.error("Failed to get user:", userError);
        return res.status(400).json({ message: "Invalid confirmation token" });
      }

      // Update user's email_confirmed_at timestamp
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(token, {
          email_confirm: true,
        });

      if (updateError) {
        console.error("Failed to confirm email:", updateError);
        return res.status(500).json({ message: "Failed to confirm email" });
      }

      // Update customer record to mark as verified
      try {
        await storage.updateCustomer(token, { isVerified: true });
        console.log("Customer marked as verified");

        // Send welcome email
        const customer = await storage.getCustomer(token);
        if (customer) {
          await emailService.sendWelcomeEmail(email, customer.name);
        }
      } catch (dbError: any) {
        console.warn("Database customer update error:", dbError);
        // Continue even if customer update fails - email is still confirmed
      }

      res.json({ message: "Email confirmed successfully" });
    } catch (error: any) {
      console.error("Email confirmation error:", error);
      res.status(500).json({ message: "Failed to confirm email" });
    }
  });

  // Cancel ride with refund (customer keeps penalty of CEO's share)
  app.post('/api/rides/:rideId/cancel', async (req, res) => {
    try {
      const { rideId } = req.params;
      const { reason } = req.body || {};

      const ride = await storage.getRide(rideId);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      // Calculate CEO share (20%) if payment exists
      const payment = await storage.getPaymentByRideId(rideId);
      let refundAmountCents = 0;
      if (payment) {
        const totalCents = Math.round(parseFloat(String((payment as any).amount)) * 100);
        const ceoCents = Math.round(totalCents * 0.2);
        refundAmountCents = Math.max(totalCents - ceoCents, 0);
      }

      // If paid via Stripe, issue partial refund
      if (payment && (payment as any).reference_id?.startsWith('pi_')) {
        const Stripe = (await import('stripe')).default;
        const { STRIPE_SECRET_KEY } = await import('./config');
        const stripe = new Stripe(STRIPE_SECRET_KEY as any);

        // Fetch latest charge on the payment intent
        const pi = await stripe.paymentIntents.retrieve((payment as any).reference_id, { expand: ['latest_charge'] });
        const chargeId = (pi.latest_charge as any)?.id as string | undefined;
        if (chargeId && refundAmountCents > 0) {
          await stripe.refunds.create({
            charge: chargeId,
            amount: refundAmountCents,
            reason: 'requested_by_customer',
          });
        }
      }

      // Cancel the ride
      const cancelled = await storage.cancelRide(rideId, reason || 'customer_cancelled');

      // Also mark any ride requests as dismissed
      const requests = await storage.getRideRequests(rideId);
      await Promise.all(requests.map(rr => storage.updateRideRequest(rr.id, { status: 'bid_dismissed' } as any)));

      return res.json({ ride: cancelled, refundAmountCents });
    } catch (err: any) {
      console.error('Cancel ride error:', err);
      return res.status(500).json({ message: 'Failed to cancel ride' });
    }
  });

  // Payment routes (Stripe only)
  app.use("/api/stripe", stripeRoutes);

  // Customer routes
  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.json({ customer });
    } catch (error: any) {
      console.error("Customer creation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create customer" });
    }
  });

  // Finish ride explicitly
  app.post('/api/rides/:id/finish', async (req, res) => {
    try {
      const { id } = req.params;
      const ride = await storage.getRide(id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      // Allow finishing from accepted or in_progress
      if (!['accepted', 'in_progress'].includes((ride as any).status)) {
        return res.status(400).json({ message: 'Ride cannot be finished in its current status' });
      }

      const updated = await storage.updateRide(id, {
        status: 'completed' as any,
        completed_at: new Date().toISOString() as any,
      } as any);

      // Optionally dismiss any remaining pending requests
      const requests = await storage.getRideRequests(id);
      await Promise.all(requests.map(rr => {
        if (rr.status !== 'bid_accepted' && rr.status !== 'bid_dismissed') {
          return storage.updateRideRequest(rr.id, { status: 'bid_dismissed' } as any);
        }
        return Promise.resolve(rr);
      }));

      res.json({ ride: updated });
    } catch (error: any) {
      console.error('Ride finish error:', error);
      res.status(500).json({ message: 'Failed to finish ride' });
    }
  });

  app.get("/api/customer/profile", async (req, res) => {
    try {
      const { customerId } = req.query;
      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json({
        customer: { ...customer, phone: undefined },
      });
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Payments history for a customer (payments + refunds)
  app.get('/api/payments', async (req, res) => {
    try {
      const { customerId } = req.query;
      if (!customerId || typeof customerId !== 'string') {
        return res.status(400).json({ message: 'customerId required' });
      }
      const { supabase } = await import('./db');
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ message: error.message });

      const { data: refunds } = await supabase
        .from('refund_logs')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      res.json({ payments: payments || [], refunds: refunds || [] });
    } catch (err: any) {
      console.error('Payments history error:', err);
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  app.put("/api/customer/profile", async (req, res) => {
    try {
      const { customerId, name, email, gender, disabledType, profilePhoto } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      // Validate gender if provided
      if (gender && !['male', 'female'].includes(gender)) {
        return res.status(400).json({ message: "Invalid gender value" });
      }

      // Validate disabled type if provided
      if (disabledType && !['none', 'hearing', 'deaf', 'blind', 'disabled'].includes(disabledType)) {
        return res.status(400).json({ message: "Invalid disabled type value" });
      }

      const updateData = {
        ...(name && { name }),
        ...(email && { email }),
        ...(gender && { gender }),
        ...(disabledType && { disabledType }),
        ...(profilePhoto && { profilePhoto }),
      };

      const updatedCustomer = await storage.updateCustomer(customerId, updateData);
      
      res.json({ 
        customer: { ...updatedCustomer, phone: undefined },
        message: "Profile updated successfully" 
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Payment method routes
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const { customerId } = req.query;
      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const paymentMethods = await storage.getPaymentMethods(customerId);
      res.json({ paymentMethods });
    } catch (error: any) {
      console.error("Payment methods fetch error:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  app.post("/api/payment-methods", async (req, res) => {
    try {
      const paymentMethodData = insertPaymentMethodSchema.parse(req.body);
      const paymentMethod =
        await storage.createPaymentMethod(paymentMethodData);
      res.json({ paymentMethod });
    } catch (error: any) {
      console.error("Payment method creation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create payment method" });
    }
  });

  // Ride routes
  app.post("/api/rides", async (req, res) => {
    try {
      // Debug logging
      console.log('Received ride data:', req.body);
      console.log('person_preference_id from request:', req.body.person_preference_id);
      console.log('ride_type_id from request:', req.body.ride_type_id);
      
      const rideData = insertRideSchema.parse(req.body);
      
      // Debug parsed data
      console.log('Parsed ride data:', rideData);
      console.log('person_preference_id after parsing:', rideData.person_preference_id);

      // Ensure total_fare is stored when booking
      if (rideData.total_fare == null) {
        // Try to read alternative client-provided fields
        const rawTotal = (req.body?.totalFare ?? req.body?.fare ?? req.body?.total_fare);
        let computed = Number.isFinite(rawTotal) ? Number(rawTotal) : parseFloat(rawTotal);
        if (!Number.isFinite(computed)) {
          // Fallback simple estimate if distance/duration available
          const miles = typeof rideData.distance_miles === 'number' ? rideData.distance_miles : undefined;
          const minutes = typeof rideData.duration_minutes === 'number' ? rideData.duration_minutes : undefined;
          if (typeof miles === 'number' || typeof minutes === 'number') {
            const perMile = 2; // fallback rate
            const perMinute = 0.5; // fallback rate
            computed = (miles || 0) * perMile + (minutes || 0) * perMinute;
          }
        }
        if (Number.isFinite(computed)) {
          rideData.total_fare = Math.max(0, Math.round((computed as number) * 100) / 100);
        }
      }

      // Create single ride booking
      const ride = await storage.createRide(rideData);

      res.json({ ride });
    } catch (error: any) {
      console.error("Ride creation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create ride" });
    }
  });

  app.get("/api/rides", async (req, res) => {
    try {
      const { customerId } = req.query;
      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const rides = await storage.getUserRides(customerId);
      res.json({ rides });
    } catch (error: any) {
      console.error("Rides fetch error:", error);
      res.status(500).json({ message: "Failed to fetch rides" });
    }
  });

  app.get("/api/rides/history", async (req, res) => {
    try {
      const { customerId } = req.query;
      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const rides = await storage.getUserRides(customerId);
      // Filter for completed and cancelled rides
      const historyRides = rides.filter((ride) =>
        ["completed", "cancelled"].includes(ride.status),
      );
      res.json(historyRides);
    } catch (error: any) {
      console.error("History fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride history" });
    }
  });

  app.get("/api/rides/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Validate UUID format to prevent parsing errors
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ message: "Invalid ride ID format" });
      }

      const ride = await storage.getRide(id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      // Include driver information if assigned
      let driver = null;
      if (ride.driver_id) {
        driver = await storage.getDriver(ride.driver_id);
      }

      res.json({ ride: { ...ride, driver } });
    } catch (error: any) {
      console.error("Ride fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride" });
    }
  });

  app.patch("/api/rides/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const ride = await storage.updateRide(id, updates);
      res.json({ ride });
    } catch (error: any) {
      console.error("Ride update error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to update ride" });
    }
  });

  app.post("/api/rides/:id/cancel", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = "", attachments = [] } = z
        .object({ reason: z.string().optional(), attachments: z.array(z.string()).optional() })
        .parse(req.body ?? {});

      const ride = await storage.getRide(id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      // Optionally store a driver report (attachments ignored for now)
      try {
        await storage.createDriverReport({
          ride_id: id as any,
          description: reason as any,
          images: (attachments as any) || [],
        } as any);
      } catch {}

      // Compute CEO invisible earning based on ride_types
      const { data: rate } = await (await import('@supabase/supabase-js')).createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        .from('ride_types')
        .select('*, ride_categories:ride_categories(*)')
        .eq('title', (ride as any).ride_type)
        .limit(1)
        .maybeSingle();

      const minutes = Number((ride as any).duration_minutes) || 0;
      const miles = Number((ride as any).estimated_distance) || 0;
      const people = Number((ride as any).rider_count) || 1;
      const pets = Number((ride as any).pet_count) || 0;
      const carsUsed = 1; // simplified; could derive from people if needed

      let totalFare = Number.parseFloat(String((ride as any).total_fare || 0)) || 0;
      let ceoInvisible = 0;
      if (rate && (rate as any).ride_categories) {
        const cat: any = (rate as any).ride_categories;
        const perDriverVisible = (cat.driver_rate_per_mile || 0) * miles + (cat.min_tip ?? 5);
        const driversTotal = perDriverVisible * carsUsed;
        ceoInvisible = ((rate as any).ceo_rate_per_minute || 0) * minutes * carsUsed;
        const extras = (cat.per_person_fee || 0) * people + (cat.per_pet_fee || 0) * pets;
        const price = Math.max(0, driversTotal + ceoInvisible + extras);
        if (!totalFare || totalFare <= 0) totalFare = price;
      }

      // Base refund before fees
      let refundAmountCents = Math.max(0, Math.round((totalFare - ceoInvisible) * 100));

      // If paid via Stripe, issue partial refund using latest charge of payment intent
      const payment = await storage.getPaymentByRideId(id);
      if (payment && (payment as any).reference_id?.startsWith('pi_') && refundAmountCents > 0) {
        const Stripe = (await import('stripe')).default;
        const { STRIPE_SECRET_KEY } = await import('./config');
        const stripe = new Stripe(STRIPE_SECRET_KEY as any);
        const pi = await stripe.paymentIntents.retrieve((payment as any).reference_id, { expand: ['latest_charge.balance_transaction'] });
        const latestCharge: any = pi.latest_charge as any;
        const chargeId = latestCharge?.id as string | undefined;
        // Determine Stripe processing fee from balance transaction
        let stripeFeeCents = 0;
        try {
          if (latestCharge?.balance_transaction) {
            const bt: any = latestCharge.balance_transaction;
            stripeFeeCents = Math.max(0, Number(bt.fee || 0));
          } else if (chargeId) {
            const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
            stripeFeeCents = Math.max(0, Number((charge as any).balance_transaction?.fee || 0));
          }
        } catch (_) {}
        // Subtract Stripe processing fee from refund
        refundAmountCents = Math.max(0, refundAmountCents - stripeFeeCents);
        if (chargeId) {
          try {
            const refund = await stripe.refunds.create({ charge: chargeId, amount: refundAmountCents, reason: 'requested_by_customer', metadata: { rideId: id } });
            // Log refund in payments table
            // try {
            //   await storage.createPayment({
            //     customer_id: (ride as any).customer_id,
            //     amount: String(-(refundAmountCents / 100)),
            //     payment_method: 'stripe_refund',
            //     reference_id: refund.id,
            //     status: 'refunded',
            //     ride_id: id,
            //     notes: 'Customer initiated refund (cancel ride)'
            //   } as any);
            // } catch (logErr) {
            //   console.warn('Payment log (refund) error:', logErr);
            // }
            // Log to refund_logs table (Supabase)
            try {
              const { supabase } = await import('./db');
              await supabase.from('refund_logs').insert({
                ride_id: id,
                customer_id: (ride as any).customer_id,
                amount: refundAmountCents / 100,
                reference_id: refund.id,
                status: refund.status,
                note: reason || 'customer_cancelled'
              } as any);
            } catch (rlErr) {
              console.warn('refund_logs insert failed:', rlErr);
            }
          } catch (e) {
            console.error('Stripe refund error:', e);
          }
        }
      }

      const cancelled = await storage.cancelRide(id, reason || 'customer_cancelled');
      const requests = await storage.getRideRequests(id);
      await Promise.all(requests.map(rr => storage.updateRideRequest(rr.id, { status: 'bid_dismissed' } as any)));

      res.json({ ride: cancelled, refundAmountCents });
    } catch (error: any) {
      console.error("Ride cancellation error:", error);
      res.status(400).json({ message: error.message || "Failed to cancel ride" });
    }
  });

  // Refund estimate (no refund performed)
  app.get('/api/rides/:id/refund-quote', async (req, res) => {
    try {
      const { id } = req.params;
      const ride = await storage.getRide(id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      const { supabase } = await import('./db');
      const { data: rate } = await supabase
        .from('ride_types')
        .select('*, ride_categories:ride_categories(*)')
        .eq('title', (ride as any).ride_type)
        .limit(1)
        .maybeSingle();

      const minutes = Number((ride as any).duration_minutes) || 0;
      const miles = Number((ride as any).estimated_distance) || 0;
      const people = Number((ride as any).rider_count) || 1;
      const pets = Number((ride as any).pet_count) || 0;
      const carsUsed = 1;

      let totalFare = Number.parseFloat(String((ride as any).total_fare || 0)) || 0;
      let ceoInvisible = 0;
      if (rate && (rate as any).ride_categories) {
        const cat: any = (rate as any).ride_categories;
        const perDriverVisible = (cat.driver_rate_per_mile || 0) * miles + (cat.min_tip ?? 5);
        const driversTotal = perDriverVisible * carsUsed;
        ceoInvisible = ((rate as any).ceo_rate_per_minute || 0) * minutes * carsUsed;
        const extras = (cat.per_person_fee || 0) * people + (cat.per_pet_fee || 0) * pets;
        const price = Math.max(0, driversTotal + ceoInvisible + extras);
        if (!totalFare || totalFare <= 0) totalFare = price;
      }

      // Determine Stripe processing fee from original payment (if exists)
      let stripeFeeCents = 0;
      try {
        const payment = await storage.getPaymentByRideId(id);
        if (payment && (payment as any).reference_id?.startsWith('pi_')) {
          const Stripe = (await import('stripe')).default;
          const { STRIPE_SECRET_KEY } = await import('./config');
          const stripe = new Stripe(STRIPE_SECRET_KEY as any);
          const pi = await stripe.paymentIntents.retrieve((payment as any).reference_id, { expand: ['latest_charge.balance_transaction'] });
          const latestCharge: any = pi.latest_charge as any;
          if (latestCharge?.balance_transaction) {
            const bt: any = latestCharge.balance_transaction;
            stripeFeeCents = Math.max(0, Number(bt.fee || 0));
          } else if ((latestCharge as any)?.id) {
            const charge = await stripe.charges.retrieve((latestCharge as any).id, { expand: ['balance_transaction'] });
            stripeFeeCents = Math.max(0, Number((charge as any).balance_transaction?.fee || 0));
          }
        }
      } catch (e) {
        console.warn('Refund quote: unable to compute stripe fee', e);
      }

      const refundAmountCents = Math.max(0, Math.round((totalFare - ceoInvisible) * 100) - stripeFeeCents);
      return res.json({ amountCents: refundAmountCents, totalFare, ceoInvisible, stripeFeeCents });
    } catch (err: any) {
      console.error('Refund quote error:', err);
      return res.status(500).json({ message: 'Failed to compute refund quote' });
    }
  });

  // Allow customer to cancel a refund when possible (Stripe supports cancel only for certain statuses)
  app.post('/api/refunds/:refundId/cancel', async (req, res) => {
    try {
      const { refundId } = req.params;
      const Stripe = (await import('stripe')).default;
      const { STRIPE_SECRET_KEY } = await import('./config');
      const stripe = new Stripe(STRIPE_SECRET_KEY as any);

      const refund = await stripe.refunds.retrieve(refundId);
      // Attempt cancel (will fail if already succeeded or not cancelable)
      let result = refund;
      try {
        result = await stripe.refunds.cancel(refundId);
      } catch (e: any) {
        // If not cancelable, surface current status
        return res.status(400).json({ message: e?.message || 'Refund cannot be canceled', status: refund.status });
      }

      // Update payments log row if we stored one
      try {
        const p = await storage.updatePaymentByReference?.(refundId as any, { status: 'canceled' } as any);
      } catch {}

      return res.json({ refund: result });
    } catch (error: any) {
      console.error('Refund cancel error:', error);
      return res.status(500).json({ message: 'Failed to cancel refund' });
    }
  });

  app.post("/api/rides/:id/rate", async (req, res) => {
    try {
      const { id } = req.params;
      const { rating, emoji } = z
        .object({
          rating: z.number().min(1).max(2), // 1 = thumbs down, 2 = thumbs up
          emoji: z.string().optional(),
        })
        .parse(req.body);

      const ride = await storage.getRide(id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });

      // Store a driver rating entry independent of ride record
      const ratingRow = await storage.createDriverRating({
        ride_id: id,
        driver_id: (ride as any).driver_id,
        customer_id: (ride as any).customer_id,
        rating,
        emoji,
      });

      // Optionally also keep simple rating fields on ride for quick access
      const updatedRide = await storage.updateRide(id, {
        customer_rating: rating,
        customer_rating_emoji: emoji,
      });

      res.json({ ride: updatedRide, driverRating: ratingRow });
    } catch (error: any) {
      console.error("Ride rating error:", error);
      res.status(400).json({ message: error.message || "Failed to rate ride" });
    }
  });

  // Handle payment success
  app.post("/api/rides/:id/payment-success", async (req, res) => {
    try {
      const { id } = req.params;
      const { pspReference, resultCode, rideId } = req.body;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ message: "Invalid ride ID format" });
      }

      // Validate required fields
      if (!pspReference || !resultCode) {
        return res.status(400).json({ message: "Missing required fields: pspReference, resultCode" });
      }

      // Check if payment was successful
      const isPaymentSuccessful = resultCode === 'Authorised' || resultCode === 'Received';

      if (isPaymentSuccessful) {
        // Update ride status to completed if not already
        const currentRide = await storage.getRide(id);
        let updatedRide = currentRide;
        
        if (currentRide && currentRide.status !== 'completed') {
          updatedRide = await storage.updateRide(id, {
            status: 'completed',
            completed_at: new Date()
          });
        }

        // Update the payment record in the database
        const { error: paymentError } = await supabaseAdmin
          .from('adyen_payments')
          .update({
            status: resultCode,
            psp_reference: pspReference,
            updated_at: new Date().toISOString()
          })
          .eq('reference', req.body.reference || `R${id.substring(0, 8)}`);

        if (paymentError) {
          console.error('Error updating payment record:', paymentError);
        }

        // Log payment success
        console.log(`Payment successful for ride ${id}: ${pspReference}`);

        res.json({ 
          success: true, 
          message: "Payment processed successfully",
          ride: updatedRide 
        });
      } else {
        // Payment failed
        res.json({ 
          success: false, 
          message: "Payment was not successful",
          resultCode: resultCode 
        });
      }

    } catch (error: any) {
      console.error("Payment success handling error:", error);
      res.status(500).json({ message: "Failed to process payment success" });
    }
  });

  // Tip bounds for a ride
  app.get("/api/rides/:id/tip-bounds", async (req, res) => {
    try {
      const { id } = req.params;
      const ride = await storage.getRide(id);
      if (!ride) return res.status(404).json({ message: "Ride not found" });

      // Prefer ride type specific min/max; fallback to category
      let min = 0;
      let max = 0;
      if ((ride as any).ride_type_id) {
        const rt = await storage.getRideTypesByCategory((ride as any).ride_type);
      
        if (rt && rt.length > 0 && (rt[0] as any).category_id) {
          const cat = await storage.getRideCategory((rt[0] as any).category_id);
          if (cat && (cat as any).min_tip && (cat as any).max_tip) {
            min = Number((cat as any).min_tip);
            max = Number((cat as any).max_tip);
          }
        }
      }

      return res.json({ min, max });
    } catch (error: any) {
      console.error("Tip bounds error:", error);
      res.status(500).json({ message: "Failed to fetch tip bounds" });
    }
  });

  // Create payment intent for tip
  app.post("/api/rides/:id/tips/payment-intent", async (req, res) => {
    try {
      const { id } = req.params;
      const { driver_id, tip_amount } = req.body as { driver_id: string; tip_amount: number };

      if (!driver_id || typeof tip_amount !== 'number') {
        return res.status(400).json({ message: "driver_id and tip_amount are required" });
      }

      const ride = await storage.getRide(id);
      if (!ride) return res.status(404).json({ message: "Ride not found" });

      // Allow tipping for rides that are accepted or in_progress (after rating)
      if (!['accepted', 'in_progress'].includes((ride as any).status)) {
        return res.status(400).json({ message: "Ride is not in a state where tipping is allowed" });
      }

      // Fetch tip bounds
      let min = 0;
      let max = 0;
      if ((ride as any).ride_type_id) {
        const rt = await storage.getRideType((ride as any).ride_type_id);
        
        if (rt && (rt as any).categoryId) {
          const cat = await storage.getRideCategory((rt as any).categoryId);
          if (cat && (cat as any).min_tip && (cat as any).max_tip) {
            min = Number((cat as any).min_tip);
            max = Number((cat as any).max_tip);
          }
        }
      }

      if ((min && tip_amount < min) || (max && tip_amount > max)) {
        return res.status(400).json({ message: `Tip must be between ${min} and ${max}` });
      }

      // Create Stripe payment intent for tip
      const Stripe = (await import('stripe')).default;
      const { STRIPE_SECRET_KEY } = await import('./config');
      const stripe = new Stripe(STRIPE_SECRET_KEY as any);

      const amountCents = Math.round(tip_amount * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          rideId: id,
          driverId: driver_id,
          customerId: (ride as any).customer_id,
          paymentType: 'tip',
          tipAmount: String(tip_amount),
        },
      });

      return res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error: any) {
      console.error("Create tip payment intent error:", error);
      res.status(500).json({ message: "Failed to create tip payment intent" });
    }
  });

  // Ride request endpoints (driver bidding system)

  // Get all driver requests/bids for a ride
  app.get("/api/rides/:id/requests", async (req, res) => {
    try {
      const { id } = req.params;

      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ message: "Invalid ride ID format" });
      }

      const requests = await storage.getRideRequests(id);
      res.json({ requests });
    } catch (error: any) {
      console.error("Ride requests fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride requests" });
    }
  });

  // Driver creates a bid/request for a ride
  app.post("/api/rides/:id/requests", async (req, res) => {
    try {
      const { id } = req.params;

      // Check if ride exists and is still accepting bids
      const ride = await storage.getRide(id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      if (ride.status !== "pending" && ride.status !== "searching_driver") {
        return res
          .status(400)
          .json({ message: "This ride is no longer accepting bids" });
      }

      const requestData = insertRideRequestSchema.parse({
        ...req.body,
        rideId: id,
      });

      // Check if driver already has a pending request for this ride
      const existingRequests = await storage.getRideRequests(id);
      const driverHasRequest = existingRequests.find(
        (r) => r.driver_id === requestData.driver_id && r.status === "pending",
      );

      if (driverHasRequest) {
        return res.status(400).json({
          message: "Driver already has a pending request for this ride",
        });
      }

      const request = await storage.createRideRequest(requestData);

      // Update ride status to "searching_driver" if it's still "pending"
      if (ride.status === "pending") {
        await storage.updateRide(id, { status: "searching_driver" });
      }

      res.json({ request });
    } catch (error: any) {
      console.error("Ride request creation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create ride request" });
    }
  });

  // Customer selects a driver
  app.post("/api/rides/:id/requests/:requestId/select", async (req, res) => {
    try {
      const { id, requestId } = req.params;

      // Validate UUID formats
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id) || !uuidRegex.test(requestId)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      // Check if ride exists and is in valid state for selection
      const ride = await storage.getRide(id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      if (
        ride.status === "accepted" ||
        ride.status === "in_progress" ||
        ride.status === "completed"
      ) {
        return res
          .status(400)
          .json({ message: "Driver already selected for this ride" });
      }

      // Get the specific request
      const request = await storage.getRideRequest(requestId);
      if (!request || request.ride_id !== id) {
        return res.status(404).json({ message: "Ride request not found" });
      }

      // Accept both pending and accepted status for demo
      if (request.status !== "pending" && request.status !== "accepted") {
        return res
          .status(400)
          .json({ message: "This request is no longer available" });
      }

      // Update the ride with selected driver and status
      await storage.updateRide(id, {
        driver_id: request.driver_id,
        status: "accepted",
        accepted_at: new Date(),
      });

      // Get updated ride with driver info
      const updatedRide = await storage.getRide(id);
      let driver = null;
      if (updatedRide?.driver_id) {
        driver = await storage.getDriver(updatedRide.driver_id);
      }

      res.json({
        ride: { ...updatedRide, driver },
        selectedRequest: request,
      });
    } catch (error: any) {
      console.error("Driver selection error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to select driver" });
    }
  });

  // Driver routes
  app.get("/api/drivers/available", async (req, res) => {
    try {
      const { lat, lng, rideType } = req.query;

      if (!lat || !lng || !rideType) {
        return res
          .status(400)
          .json({ message: "Location and ride type are required" });
      }

      const drivers = await storage.getAvailableDrivers(
        parseFloat(lat as string),
        parseFloat(lng as string),
        rideType as string,
      );

      res.json({ drivers });
    } catch (error: any) {
      console.error("Available drivers fetch error:", error);
      res.status(500).json({ message: "Failed to fetch available drivers" });
    }
  });

  // Chat routes
  app.post("/api/chat/message", async (req, res) => {
    try {
      const messageData = insertYahMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);

      // TODO: Integrate with AI service for automated responses
      if (messageData.sender_role === "customer") {
        // Generate AI response
        const aiResponse =
          "Thank you for your message. How can I assist you with your ride?";

        const aiMessage = await storage.createChatMessage({
          ride_id: messageData.ride_id,
          sender_by: messageData.sender_by,
          sender_role: "driver",
          message: aiResponse,
          chat_session_id: messageData.chat_session_id,
          is_deleted: false,
          is_read: false,
        });

        res.json({ message, aiMessage });
      } else {
        res.json({ message });
      }
    } catch (error: any) {
      console.error("Chat message error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to send message" });
    }
  });

  app.get("/api/chat/messages", async (req, res) => {
    try {
      const { customerId, rideId } = req.query;

      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const messages = await storage.getChatMessages(
        customerId,
        rideId as string | undefined,
      );

      res.json({ messages });
    } catch (error: any) {
      console.error("Chat messages fetch error:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // YahChat session endpoints
  app.get("/api/chat/sessions", async (req, res) => {
    try {
      const { customerId, driverId, rideId } = req.query;

      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const sessions = await storage.getActiveChatSessions(
        customerId,
        driverId as string | undefined,
        rideId as string | undefined,
      );

      res.json({ sessions });
    } catch (error: any) {
      console.error("Chat sessions fetch error:", error);
      res.status(500).json({ message: "Failed to fetch chat sessions" });
    }
  });

  app.post("/api/chat/sessions", async (req, res) => {
    try {
      const sessionData = insertYahChatSessionSchema.parse(req.body);
      const session = await storage.createChatSession(sessionData);

      res.json({ session });
    } catch (error: any) {
      console.error("Chat session creation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create chat session" });
    }
  });

  app.patch("/api/chat/sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const session = await storage.updateChatSession(id, updates);

      res.json({ session });
    } catch (error: any) {
      console.error("Chat session update error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to update chat session" });
    }
  });

  // Driver report routes
  app.post("/api/reports/driver", async (req, res) => {
    try {
      const reportData = insertDriverReportSchema.parse(req.body);
      const report = await storage.createDriverReport(reportData);

      // TODO: Send notification to admin

      res.json({ report });
    } catch (error: any) {
      console.error("Driver report error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create report" });
    }
  });

  // Saved locations routes
  app.get("/api/saved-locations", async (req, res) => {
    try {
      const { customerId } = req.query;

      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ message: "Customer ID is required" });
      }

      const locations = await storage.getSavedLocations(customerId);
      res.json({ locations });
    } catch (error: any) {
      console.error("Saved locations fetch error:", error);
      res.status(500).json({ message: "Failed to fetch saved locations" });
    }
  });

  // Ride categories routes
  app.get("/api/ride-categories", async (req, res) => {
    try {
      const rideCategories = await storage.getRideCategories();
      res.json({ rideCategories });
    } catch (error: any) {
      console.error("Ride categories fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride categories" });
    }
  });

  app.get("/api/ride-categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const rideCategory = await storage.getRideCategory(id);

      if (!rideCategory) {
        return res.status(404).json({ message: "Ride category not found" });
      }

      res.json({ rideCategory });
    } catch (error: any) {
      console.error("Ride category fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride category" });
    }
  });

  app.post("/api/ride-categories", async (req, res) => {
    try {
      const rideCategoryData = insertRideCategorySchema.parse(req.body);
      const rideCategory = await storage.createRideCategory(rideCategoryData);

      res.json({ rideCategory });
    } catch (error: any) {
      console.error("Ride category creation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create ride category" });
    }
  });

  app.patch("/api/ride-categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const rideCategory = await storage.updateRideCategory(id, updates);
      res.json({ rideCategory });
    } catch (error: any) {
      console.error("Ride category update error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to update ride category" });
    }
  });

  app.delete("/api/ride-categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRideCategory(id);
      res.json({ message: "Ride category deleted successfully" });
    } catch (error: any) {
      console.error("Ride category deletion error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to delete ride category" });
    }
  });

  // Ride types routes
  app.get("/api/ride-types", async (req, res) => {
    try {
      const { category } = req.query;

      let rideTypes;
      if (category && typeof category === "string") {
        rideTypes = await storage.getRideTypesByCategory(category);
      } else {
        rideTypes = await storage.getRideTypes();
      }

      res.json({ rideTypes });
    } catch (error: any) {
      console.error("Ride types fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride types" });
    }
  });

  // Infer ride categories from ride types until a dedicated table is connected
  app.get("/api/ride-categories", async (_req, res) => {
    try {
      const rideTypes = await storage.getRideTypes();
      const categories: Record<string, { id: string; name: string; tripArea: 'in-city' | 'out-of-city' }> = {};
      const inferTripArea = (title: string): 'in-city' | 'out-of-city' => title.toLowerCase().includes('travel') ? 'out-of-city' : 'in-city';
      const inferCategoryId = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('travel')) {
          if (t.includes('individual')) return 'travel-individual';
          if (t.includes('group') || t.includes('family')) return 'travel-group';
          if (t.includes('business') || t.includes('medical')) return 'travel-purpose';
          if (t.includes('engagement') || t.includes('union') || t.includes('marriage') || t.includes('honeymoon')) return 'travel-relationship';
          if (t.includes('army') || t.includes('military') || t.includes('security')) return 'travel-protected';
          if (t.includes('royal') || t.includes('celebrity') || t.includes('elite')) return 'travel-luxury';
          if (t.includes('quiet') || t.includes('silent')) return 'travel-quiet';
          return 'travel-basic';
        }
        if (t.includes('youth') || t.includes('man') || t.includes('woman') || t.includes('senior') || t.includes('single') || t.includes('solo')) return 'individual';
        if (t.includes('couple') || t.includes('engagement') || t.includes('union') || t.includes('dating') || t.includes('marriage') || t.includes('wedding') || t.includes('match') || t.includes('pure')) return 'relationship';
        if (t.includes('birthday') || t.includes('valentine') || t.includes('party') || t.includes('invitation')) return 'event';
        if (t.includes('army') || t.includes('military') || t.includes('security')) return 'protected';
        if (t.includes('royal') || t.includes('celebrity') || t.includes('elite')) return 'luxury';
        if (t.includes('business') || t.includes('medical')) return 'service';
        return 'regular';
      };

      for (const rt of rideTypes as any[]) {
        const title = String(rt.title || rt.name || '');
        const id = inferCategoryId(title);
        const tripArea = inferTripArea(title);
        if (!categories[id]) {
          categories[id] = { id, name: id.replace(/-/g, ' '), tripArea };
        }
      }
      res.json({ categories: Object.values(categories) });
    } catch (error: any) {
      console.error("Ride categories fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride categories" });
    }
  });

  // Filter ride types by category and tripArea
  app.get("/api/ride-types/by-category", async (req, res) => {
    try {
      const { categoryId, tripArea } = req.query as { categoryId?: string; tripArea?: 'in-city' | 'out-of-city' };
      
      console.log('Fetching ride types for categoryId:', categoryId, 'tripArea:', tripArea);
      
      if (!categoryId) {
        return res.status(400).json({ message: "Category ID is required" });
      }

      // Get ride types filtered by category ID
      const rideTypes = await storage.getRideTypesByCategoryId(categoryId);
      console.log('Found ride types:', rideTypes.length, 'for categoryId:', categoryId);
      
      // Filter by trip area if specified
      let filtered = rideTypes;
      if (tripArea) {
        // Get the category to check its scope
        const category = await storage.getRideCategory(categoryId);
        if (category) {
          const isInCity = category.scope === 'In-City' || category.scope === 'in-city';
          const isOutOfCity = category.scope === 'Out-of-City / Out-of-State / Travel' || 
                             category.scope === 'out-of-city' || 
                             category.scope === 'travel';
          
          if ((tripArea === 'in-city' && !isInCity) || (tripArea === 'out-of-city' && !isOutOfCity)) {
            filtered = []; // No matching ride types for this trip area
          }
        }
      }

      res.json({ rideTypes: filtered });
    } catch (error: any) {
      console.error("Ride types by category fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride types by category" });
    }
  });

  app.get("/api/ride-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const rideType = await storage.getRideType(id);

      if (!rideType) {
        return res.status(404).json({ message: "Ride type not found" });
      }

      res.json({ rideType });
    } catch (error: any) {
      console.error("Ride type fetch error:", error);
      res.status(500).json({ message: "Failed to fetch ride type" });
    }
  });

  app.post("/api/ride-types", async (req, res) => {
    try {
      const rideTypeData = insertRideTypeSchema.parse(req.body);
      const rideType = await storage.createRideType(rideTypeData);

      res.json({ rideType });
    } catch (error: any) {
      console.error("Ride type creation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create ride type" });
    }
  });

  app.patch("/api/ride-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const rideType = await storage.updateRideType(id, updates);
      res.json({ rideType });
    } catch (error: any) {
      console.error("Ride type update error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to update ride type" });
    }
  });

  // Simple in-memory cache for location searches
  const locationCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Location search endpoint using OpenStreetMap Nominatim API
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { query } = z.object({ query: z.string().min(2) }).parse(req.query);

      // Check cache first
      const cacheKey = query.toLowerCase();
      const cachedResult = locationCache.get(cacheKey);
      if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
        return res.json(cachedResult.data);
      }

      // Add delay to respect Nominatim rate limits (max 1 request per second)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Use OpenStreetMap Nominatim API for location search
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&extratags=1`,
        {
          headers: {
            "User-Agent": "YahRideApp/1.0 (contact@yahrides.com)",
          },
        },
      );

      if (!nominatimResponse.ok) {
        throw new Error(`Nominatim API error: ${nominatimResponse.status}`);
      }

      const nominatimData = await nominatimResponse.json();

      // Convert Nominatim results to our format
      const suggestions = nominatimData
        .slice(0, 5)
        .map((place: any, index: number) => {
          // Determine location type based on OSM data
          let locationType = "address";
          if (
            place.class === "building" ||
            place.class === "amenity" ||
            place.class === "shop" ||
            place.class === "tourism"
          ) {
            locationType = "establishment";
          } else if (
            place.class === "place" &&
            (place.type === "city" ||
              place.type === "town" ||
              place.type === "village")
          ) {
            locationType = "locality";
          }

          // Create display name from name or address components
          let displayName = place.name || "";
          if (!displayName && place.address) {
            displayName =
              place.address.house_number && place.address.road
                ? `${place.address.house_number} ${place.address.road}`
                : place.address.road || place.display_name.split(",")[0];
          }
          if (!displayName) {
            displayName = place.display_name.split(",")[0];
          }

          return {
            id: place.place_id?.toString() || `osm-${index}`,
            displayName,
            formattedAddress: place.display_name,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon),
            type: locationType,
          };
        });

      const result = { suggestions };

      // Cache the result
      locationCache.set(cacheKey, { data: result, timestamp: Date.now() });

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching location suggestions:", error);
      res.status(500).json({ message: "Failed to fetch location suggestions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
