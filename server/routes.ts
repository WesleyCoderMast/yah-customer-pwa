import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailService } from "./emailService";
import { wiseService } from "./wiseService";
import { z } from "zod";
import {
  insertPaymentMethodSchema,
  insertRideSchema,
  insertYahMessageSchema,
  insertDriverReportSchema,
  insertRideTypeSchema,
  insertCustomerSchema,
  insertRideRequestSchema,
  insertYahChatSessionSchema,
} from "@shared/schema";
import { createClient } from "@supabase/supabase-js";
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config";
import paymentRoutes from "./paymentRoutes";
import { scheduledPayoutService } from "./scheduledPayoutService";

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

  // Payment routes
  app.use("/api/payments", paymentRoutes);

  // Start scheduled payout service
  scheduledPayoutService.start();

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

      res.json({ customer: { ...customer, phone: undefined } });
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
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

  // Payment processing routes
  app.post("/api/payments/process", async (req, res) => {
    try {
      const {
        rideId,
        requestId,
        amount,
        cardNumber,
        expiryDate,
        securityCode,
        cardHolderName,
        country,
        postalCode,
      } = req.body;

      // Validate required fields
      if (
        !rideId ||
        !requestId ||
        !amount ||
        !cardNumber ||
        !expiryDate ||
        !securityCode ||
        !cardHolderName ||
        !country ||
        !postalCode
      ) {
        return res
          .status(400)
          .json({ message: "All payment fields are required" });
      }

      // Validate ride and request exist
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const request = await storage.getRideRequest(requestId);
      if (!request || request.ride_id !== rideId) {
        return res.status(404).json({ message: "Ride request not found" });
      }

      // Process payment through Rapyd
      const paymentResult = await wiseService.processCardPayment({
        amount: parseFloat(amount),
        currency: "USD",
        cardNumber,
        expiryDate,
        securityCode,
        cardHolderName,
        billingAddress: {
          country,
          postalCode,
        },
        description: `Yah Ride Payment - ${ride.ride_type}`,
        reference: rideId,
      });
      console.log(
        "****************** here is payment result *************************",
      );
      console.log(paymentResult);
      if (paymentResult.success) {
        // Payment successful - update ride with selected driver
        await storage.updateRide(rideId, {
          driver_id: request.driver_id,
          status: "accepted",
          accepted_at: new Date(),
        });

        // Store payment record
        await storage.createPayment({
          customer_id: ride.customer_id,
          amount: parseFloat(amount).toString(),
          payment_method: "card",
          reference_id: paymentResult.paymentId || "",
          status: "completed",
          notes: `Yah Ride Payment - ${ride.ride_type}`,
          ride_id: rideId,
        });

        // Calculate payment split (driver gets 80%, CEO gets 20%)
        const totalAmount = parseFloat(amount);
        const driverAmount = totalAmount * 0.8;
        const ceoAmount = totalAmount * 0.2;

        try {
          // Get driver beneficiary for automatic payout
          const driverBeneficiary = await storage.getRapydBeneficiaryByDriver(
            request.driver_id,
          );

          if (driverBeneficiary) {
            const { processAutomaticPayouts } = await import("./rapyd");

            // Trigger automatic payouts to driver and CEO
            await processAutomaticPayouts({
              rideId,
              driverAmount,
              ceoAmount,
              currency: "USD",
              driverBeneficiaryId: driverBeneficiary.beneficiary_id,
              ceoBeneficiaryId: "ceo_beneficiary_id", // TODO: Get from config
            });

            // Store payment split record
            await storage.createPaymentSplit({
              payment_id: parseInt(paymentResult.paymentId || "0"),
              ride_id: rideId,
              driver_id: request.driver_id,
              total_amount: totalAmount.toString(),
              driver_amount: driverAmount.toString(),
              ceo_amount: ceoAmount.toString(),
              driver_beneficiary_id: driverBeneficiary.beneficiary_id,
              ceo_beneficiary_id: "ceo_beneficiary_id",
              split_status: "completed",
              rapyd_payment_id: paymentResult.paymentId,
            });
          }
        } catch (error: any) {
          console.error("Error processing automatic payouts:", error);
          // Payment succeeded but payout failed - this should be handled by retry logic
        }

        // Get updated ride with driver info
        const updatedRide = await storage.getRide(rideId);
        let driver = null;
        if (updatedRide?.driver_id) {
          driver = await storage.getDriver(updatedRide.driver_id);
        }

        res.json({
          success: true,
          ride: { ...updatedRide, driver },
          payment: {
            id: paymentResult.paymentId,
            status: "completed",
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: paymentResult.error || "Payment processing failed",
        });
      }
    } catch (error: any) {
      console.error("Payment processing error:", error);
      res.status(500).json({ message: "Payment processing failed" });
    }
  });

  app.post("/api/payments/refund", async (req, res) => {
    try {
      const { paymentId, amount, reason } = req.body;

      if (!paymentId || !amount || !reason) {
        return res
          .status(400)
          .json({ message: "Payment ID, amount, and reason are required" });
      }

      const refundResult = await wiseService.processRefund(
        paymentId,
        parseFloat(amount),
        reason,
      );

      if (refundResult.success) {
        res.json({
          success: true,
          refund: {
            id: refundResult.paymentId,
            status: "completed",
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: refundResult.error || "Refund processing failed",
        });
      }
    } catch (error: any) {
      console.error("Refund processing error:", error);
      res.status(500).json({ message: "Refund processing failed" });
    }
  });

  // Ride routes
  app.post("/api/rides", async (req, res) => {
    try {
      // Debug logging
      console.log('Received ride data:', req.body);
      console.log('person_preference_id from request:', req.body.person_preference_id);
      
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
      const { reason } = z.object({ reason: z.string() }).parse(req.body);

      const ride = await storage.cancelRide(id, reason);
      res.json({ ride });
    } catch (error: any) {
      console.error("Ride cancellation error:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to cancel ride" });
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

      const ride = await storage.updateRide(id, {
        customer_rating: rating,
        customer_rating_emoji: emoji,
      });

      res.json({ ride });
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
      const { category, tripArea } = req.query as { category?: string; tripArea?: 'in-city' | 'out-of-city' };
      const rideTypes = await storage.getRideTypes();
      const areaOf = (title: string) => title.toLowerCase().includes('travel') ? 'out-of-city' : 'in-city';
      const catOf = (title: string) => {
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

      const filtered = (rideTypes as any[]).filter(rt => {
        const title = String(rt.title || rt.name || '');
        const a = areaOf(title);
        const c = catOf(title);
        if (tripArea && a !== tripArea) return false;
        if (category && c !== category) return false;
        return true;
      });

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
  // Rapyd payment integration routes

  // Webhook endpoint for Rapyd payment status updates
  app.post("/api/rapyd/webhook", async (req, res) => {
    try {
      const signature = req.headers["signature"] as string;
      const salt = req.headers["salt"] as string;
      const timestamp = req.headers["timestamp"] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook signature
      const { rapydClient } = await import("./rapyd");
      const isValid = rapydClient.verifyWebhookSignature(
        body,
        signature,
        salt,
        timestamp,
      );

      if (!isValid) {
        console.error("Invalid Rapyd webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }

      const { type, data } = req.body;

      // Handle different webhook events
      switch (type) {
        case "PAYMENT_COMPLETED":
          await handlePaymentCompleted(data);
          break;
        case "PAYMENT_FAILED":
          await handlePaymentFailed(data);
          break;
        case "PAYOUT_COMPLETED":
          await handlePayoutCompleted(data);
          break;
        case "PAYOUT_FAILED":
          await handlePayoutFailed(data);
          break;
        default:
          console.log(`Unhandled webhook event: ${type}`);
      }

      res.json({ status: "received" });
    } catch (error: any) {
      console.error("Rapyd webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Create driver beneficiary
  app.post("/api/rapyd/beneficiary/driver", async (req, res) => {
    try {
      const {
        driverId,
        firstName,
        lastName,
        email,
        phone,
        country,
        currency,
        bankDetails,
      } = req.body;

      if (
        !driverId ||
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !country ||
        !currency ||
        !bankDetails
      ) {
        return res
          .status(400)
          .json({ error: "Missing required beneficiary data" });
      }

      const { createDriverBeneficiary } = await import("./rapyd");
      const rapydResponse = await createDriverBeneficiary({
        driverId,
        firstName,
        lastName,
        email,
        phone,
        country,
        currency,
        bankDetails,
      });

      // Store beneficiary info in database
      const beneficiaryData = {
        driver_id: driverId,
        beneficiary_id: rapydResponse.data.id,
        beneficiary_type: "driver" as const,
        payment_method: "bank_transfer",
        country,
        currency,
      };

      const beneficiary = await storage.createRapydBeneficiary(beneficiaryData);

      res.json({ beneficiary, rapydResponse: rapydResponse.data });
    } catch (error: any) {
      console.error("Failed to create driver beneficiary:", error);
      res.status(500).json({ error: "Failed to create beneficiary" });
    }
  });

  // Process ride payment with split
  app.post("/api/rapyd/payment/split", async (req, res) => {
    try {
      const {
        rideId,
        totalAmount,
        currency,
        driverAmount,
        ceoAmount,
        paymentMethod,
        customerId,
      } = req.body;

      if (
        !rideId ||
        !totalAmount ||
        !currency ||
        !driverAmount ||
        !ceoAmount ||
        !paymentMethod ||
        !customerId
      ) {
        return res.status(400).json({ error: "Missing required payment data" });
      }

      // Get driver and CEO beneficiaries
      const ride = await storage.getRide(rideId);
      if (!ride || !ride.driver_id) {
        return res.status(404).json({ error: "Ride or driver not found" });
      }

      const driverBeneficiary = await storage.getRapydBeneficiaryByDriver(
        ride.driver_id,
      );
      if (!driverBeneficiary) {
        return res.status(404).json({ error: "Driver beneficiary not found" });
      }

      // Hardcoded CEO beneficiary ID (should be stored in config/database)
      const ceoBeneficiaryId = "ceo_beneficiary_id"; // TODO: Get from config

      const { processRidePayment, processAutomaticPayouts } = await import(
        "./rapyd"
      );

      // First collect payment to platform
      const paymentResponse = await processRidePayment({
        rideId,
        totalAmount,
        currency,
        paymentMethod,
        customerId,
      });

      if (paymentResponse.status?.status === "ACT") {
        // Payment successful - trigger automatic payouts
        await processAutomaticPayouts({
          rideId,
          driverAmount,
          ceoAmount,
          currency,
          driverBeneficiaryId: driverBeneficiary.beneficiary_id,
          ceoBeneficiaryId,
        });
      }

      // Store payment split info in database
      const splitData = {
        payment_id: paymentResponse.data.id,
        ride_id: rideId,
        driver_id: ride.driver_id,
        total_amount: totalAmount.toString(),
        driver_amount: driverAmount.toString(),
        ceo_amount: ceoAmount.toString(),
        driver_beneficiary_id: driverBeneficiary.beneficiary_id,
        ceo_beneficiary_id: ceoBeneficiaryId,
        split_status: "pending" as const,
        rapyd_payment_id: paymentResponse.data?.id,
      };

      const paymentSplit = await storage.createPaymentSplit(splitData);

      res.json({ paymentSplit, rapydResponse: paymentResponse.data });
    } catch (error: any) {
      console.error("Failed to process split payment:", error);
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // Create instant payout for driver
  app.post("/api/rapyd/payout/instant", async (req, res) => {
    try {
      const { driverId, amount, currency, description } = req.body;

      if (!driverId || !amount || !currency) {
        return res.status(400).json({ error: "Missing required payout data" });
      }

      const driverBeneficiary =
        await storage.getRapydBeneficiaryByDriver(driverId);
      if (!driverBeneficiary) {
        return res.status(404).json({ error: "Driver beneficiary not found" });
      }

      const { processInstantPayout } = await import("./rapyd");
      const payoutResponse = await processInstantPayout({
        driverId,
        amount,
        currency,
        beneficiaryId: driverBeneficiary.beneficiary_id,
        description,
      });

      // Store payout info in database
      const payoutData = {
        driver_id: driverId,
        amount: amount.toString(),
        currency,
        beneficiary_id: driverBeneficiary.beneficiary_id,
        payout_type: "instant" as const,
        status: "pending" as const,
        rapyd_payout_id: payoutResponse.data.id,
        description,
      };

      const driverPayout = await storage.createDriverPayout(payoutData);

      res.json({ payout: driverPayout, rapydResponse: payoutResponse.data });
    } catch (error: any) {
      console.error("Failed to create instant payout:", error);
      res.status(500).json({ error: "Failed to create payout" });
    }
  });

  // Helper functions for webhook event handling
  async function handlePaymentCompleted(data: any) {
    try {
      const paymentSplit = await storage.getPaymentSplitByPayment(data.id);
      if (paymentSplit) {
        await storage.updatePaymentSplit(paymentSplit.id, {
          split_status: "completed",
        });
      }
    } catch (error) {
      console.error("Error handling payment completed:", error);
    }
  }

  async function handlePaymentFailed(data: any) {
    try {
      const paymentSplit = await storage.getPaymentSplitByPayment(data.id);
      if (paymentSplit) {
        await storage.updatePaymentSplit(paymentSplit.id, {
          split_status: "failed",
        });
      }
    } catch (error) {
      console.error("Error handling payment failed:", error);
    }
  }

  async function handlePayoutCompleted(data: any) {
    try {
      // Find payout by rapyd_payout_id and update status
      const payouts = await storage.getPendingPayouts();
      const payout = payouts.find((p) => p.rapyd_payout_id === data.id);
      if (payout) {
        await storage.updateDriverPayout(payout.id, {
          status: "completed",
          completed_at: new Date(),
        });
      }
    } catch (error) {
      console.error("Error handling payout completed:", error);
    }
  }

  async function handlePayoutFailed(data: any) {
    try {
      // Find payout by rapyd_payout_id and update status
      const payouts = await storage.getPendingPayouts();
      const payout = payouts.find((p) => p.rapyd_payout_id === data.id);
      if (payout) {
        await storage.updateDriverPayout(payout.id, {
          status: "failed",
          failed_reason: data.failure_reason || "Unknown error",
        });
      }
    } catch (error) {
      console.error("Error handling payout failed:", error);
    }
  }

  return httpServer;
}
