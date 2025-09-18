import { Request, Response } from 'express';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './config';
import { storage } from './storage';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const buf = req.body as Buffer; // provided by express.raw

    const event = stripe.webhooks.constructEvent(buf, sig, STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'payment_intent.succeeded':
        {
          const pi = event.data.object as Stripe.PaymentIntent;
          const rideId = (pi.metadata as any)?.rideId;
          const requestId = (pi.metadata as any)?.requestId;
          const customerId = (pi.metadata as any)?.customerId;

          if (rideId && requestId) {
            try {
              const request = await storage.getRideRequest(requestId);
              const driverId = (request as any)?.driver_id;

              // Mark ride as accepted and assign driver
              await storage.updateRide(rideId, {
                status: 'accepted' as any,
                accepted_at: new Date().toISOString() as any,
                driver_id: driverId,
              } as any);

              // Record payment
              const paymentRow = await storage.createPayment({
                customer_id: customerId || (request as any)?.customer_id,
                amount: String((pi.amount_received ?? pi.amount) / 100),
                payment_method: 'stripe',
                reference_id: pi.id,
                status: 'completed',
                ride_id: rideId,
                notes: 'Stripe PaymentIntent'
              } as any);

              // Payment logs table (optional)
              try {
                const { supabase } = await import('./db');
                await supabase.from('payment_logs').insert({
                  ride_id: rideId,
                  customer_id: customerId,
                  provider: 'stripe',
                  event: 'payment_intent.succeeded',
                  reference: pi.id,
                  amount: (pi.amount_received ?? pi.amount) / 100,
                  created_at: new Date().toISOString(),
                } as any);
              } catch {}

              // Update all ride requests for this ride
              const allRequests = await storage.getRideRequests(rideId);
              for (const rr of allRequests) {
                const newStatus = rr.id === requestId ? 'bid_accepted' : 'bid_dismissed';
                await storage.updateRideRequest(rr.id, {
                  status: newStatus as any,
                  accepted_at: rr.id === requestId ? new Date().toISOString() as any : undefined,
                } as any);
              }
            } catch (dbErr) {
              console.error('Error updating ride/requests after payment:', dbErr);
            }
          }
        }
        break;
      case 'payment_intent.payment_failed':
        {
          const failed = event.data.object as Stripe.PaymentIntent;
          console.warn('Payment failed:', failed.id, failed.last_payment_error?.message);
        }
        break;
      default:
        break;
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook error:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}



