import { Request, Response } from 'express';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './config';
import { storage } from './storage';

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Handle tip payment success
async function handleTipPaymentSuccess(pi: Stripe.PaymentIntent) {
  const rideId = (pi.metadata as any)?.rideId;
  const driverId = (pi.metadata as any)?.driverId;
  const customerId = (pi.metadata as any)?.customerId;
  const tipAmount = (pi.amount_received ?? pi.amount) / 100;

  try {
    // 1. Store tip in ride record
    const ride = await storage.getRide(rideId);
    if (ride) {
      const currentTip = Number((ride as any).tip_amount || 0);
      await storage.updateRide(rideId, { 
        tip_amount: String(currentTip + tipAmount),
        total_fare: (ride.total_fare ?? 0) + tipAmount,
        driver_earning: ((ride as any).driver_earning ?? 0) + tipAmount,
      } as any);
    }

    // 2. Add customer payment history (this serves as the payment log)
    await storage.createPayment({
      customer_id: customerId,
      amount: String(tipAmount),
      payment_method: 'tip',
      reference_id: pi.id,
      status: 'completed',
      ride_id: rideId,
      notes: 'Customer tip'
    } as any);

    // 3. Create driver earnings record
    await createDriverEarningsRecord(driverId, rideId, tipAmount, 0, true);

    console.log(`Tip payment processed successfully for ride ${rideId}, amount: $${tipAmount}`);
  } catch (error) {
    console.error('Error processing tip payment:', error);
    throw error;
  }
}

// Helper function to create driver earnings record
async function createDriverEarningsRecord(driverId: string, rideId: string, tipAmount: number, baseFareAmount?: number, isTip: boolean = false) {
  try {
    const { supabase } = await import('./db');
    
    // Get ride details to calculate other fields
    const ride = await storage.getRide(rideId);
    if (!ride) {
      throw new Error(`Ride ${rideId} not found`);
    }

    const milesDriven = Number((ride as any).distance_miles || 0);
    const ride_driver_earnings = Number((ride as any).driver_earning ?? 0);
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const totalEarning = isTip ? tipAmount : ride_driver_earnings;
    const { data, error } = await supabase
      .from('driver_earnings')
      .insert({
        driver_id: driverId,
        ride_id: rideId,
        date: currentDate,
        miles_driven: String(milesDriven),
        tips_received: String(tipAmount),
        base_fare: 0,
        total_earning: totalEarning,
        type: isTip ? 'tip' : 'ride_payment',
        currency: 'USD',
        payout_status: 'pending',
        tax_notice_acknowledged: true,
        download_ready: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating driver earnings record:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create driver earnings record:', error);
    throw error;
  }
}

// Helper function to create driver earnings refund record
async function createDriverEarningsRefundRecord(driverId: string, rideId: string, refundAmount: number, refundType: 'tip' | 'ride_payment') {
  try {
    const { supabase } = await import('./db');
    
    // Get ride details to calculate other fields
    const ride = await storage.getRide(rideId);
    if (!ride) {
      throw new Error(`Ride ${rideId} not found`);
    }

    const milesDriven = Number((ride as any).distance_miles || 0);
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // For refunds, we create a negative earning record
    const negativeRefundAmount = -Math.abs(refundAmount);
    
    const { data, error } = await supabase
      .from('driver_earnings')
      .insert({
        driver_id: driverId,
        ride_id: rideId,
        date: currentDate,
        miles_driven: String(milesDriven),
        tips_received: refundType === 'tip' ? String(negativeRefundAmount) : '0',
        base_fare: refundType === 'ride_payment' ? String(negativeRefundAmount) : '0',
        total_earning: String(negativeRefundAmount),
        type: 'refund',
        currency: 'USD',
        payout_status: 'refunded',
        tax_notice_acknowledged: true,
        download_ready: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating driver earnings refund record:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create driver earnings refund record:', error);
    throw error;
  }
}

// Handle regular ride payment success
async function handleRidePaymentSuccess(pi: Stripe.PaymentIntent) {
  const rideId = (pi.metadata as any)?.rideId;
  const requestId = (pi.metadata as any)?.requestId;
  const customerId = (pi.metadata as any)?.customerId;

  try {
    const request = await storage.getRideRequest(requestId);
    const driverId = (request as any)?.driver_id;

    // Mark ride as accepted and assign driver
    await storage.updateRide(rideId, {
      status: 'accepted' as any,
      accepted_at: new Date().toISOString() as any,
      driver_id: driverId,
    } as any);

    // Record payment (this serves as the payment log)
    await storage.createPayment({
      customer_id: customerId || (request as any)?.customer_id,
      amount: String((pi.amount_received ?? pi.amount) / 100),
      payment_method: 'ride_payment',
      reference_id: pi.id,
      status: 'completed',
      ride_id: rideId,
      notes: 'Ride payment via Stripe'
    } as any);

    // Create driver earnings record for the ride payment
    const ridePaymentAmount = (pi.amount_received ?? pi.amount) / 100;
    await createDriverEarningsRecord(driverId, rideId, 0, ridePaymentAmount); // 0 tips, full amount as base fare

    // Update all ride requests for this ride
    const allRequests = await storage.getRideRequests(rideId);
    for (const rr of allRequests) {
      const newStatus = rr.id === requestId ? 'bid_accepted' : 'bid_dismissed';
      await storage.updateRideRequest(rr.id, {
        status: newStatus as any,
        accepted_at: rr.id === requestId ? new Date().toISOString() as any : undefined,
      } as any);
    }

    console.log(`Ride payment processed successfully for ride ${rideId}, amount: $${(pi.amount_received ?? pi.amount) / 100}`);
  } catch (error) {
    console.error('Error processing ride payment:', error);
    throw error;
  }
}

// Handle refund success
async function handleRefundSuccess(charge: Stripe.Charge) {
  try {
    // Get the payment intent from the charge
    const paymentIntent = charge.payment_intent as string;
    if (!paymentIntent) {
      console.error('No payment intent found for charge:', charge.id);
      return;
    }

    // Get the payment intent details to access metadata
    const pi = await stripe.paymentIntents.retrieve(paymentIntent);
    const rideId = (pi.metadata as any)?.rideId;
    const paymentType = (pi.metadata as any)?.paymentType;
    const customerId = (pi.metadata as any)?.customerId;
    const driverId = (pi.metadata as any)?.driverId;

    if (!rideId) {
      console.error('No ride ID found in payment intent metadata:', paymentIntent);
      return;
    }

    const refundAmount = (charge.amount_refunded || 0) / 100; // Convert from cents
    const originalAmount = (charge.amount || 0) / 100;

    // Record the refund in payments table
    await storage.createPayment({
      customer_id: customerId,
      amount: 0 - refundAmount,
      payment_method: paymentType === 'tip' ? 'tip_refund' : 'ride_refund',
      reference_id: charge.id,
      status: 'refunded',
      ride_id: rideId,
      notes: `Refund for ${paymentType === 'tip' ? 'tip' : 'ride'} payment - ${charge.id}`
    } as any);

    // Update ride record based on payment type
    const ride = await storage.getRide(rideId);
    if (ride) {
      if (paymentType === 'tip') {
        // Handle tip refund
        const currentTip = Number((ride as any).tip_amount || 0);
        const newTipAmount = Math.max(0, currentTip - refundAmount);
        
        await storage.updateRide(rideId, { 
          tip_amount: String(newTipAmount),
          total_fare: String(Math.max(0, Number((ride as any).total_fare || 0) - refundAmount)),
          driver_earning: String(Math.max(0, Number((ride as any).driver_earning || 0) - refundAmount)),
        } as any);

        // Create a driver earnings refund record for the refunded tip
        await createDriverEarningsRefundRecord(driverId, rideId, refundAmount, 'tip');
      } else {
        // Handle ride payment refund
        const currentTotalFare = Number((ride as any).total_fare || 0);
        const newTotalFare = Math.max(0, currentTotalFare - refundAmount);
        
        await storage.updateRide(rideId, { 
          total_fare: String(newTotalFare),
          driver_earning: String(Math.max(0, Number((ride as any).driver_earning || 0) - refundAmount)),
        } as any);

        // Create a driver earnings refund record for the refunded ride payment
        await createDriverEarningsRefundRecord(driverId, rideId, refundAmount, 'ride_payment');
      }
    }

    console.log(`Refund processed successfully for ride ${rideId}, amount: $${refundAmount}`);
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

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
          const paymentType = (pi.metadata as any)?.paymentType;

          // Handle tip payments
          if (paymentType === 'tip' && rideId) {
            try {
              await handleTipPaymentSuccess(pi);
            } catch (error) {
              console.error('Failed to process tip payment:', error);
              // Don't throw here to avoid webhook retry issues
            }
          }
          // Handle regular ride payments
          else if (rideId && requestId) {
            try {
              await handleRidePaymentSuccess(pi);
            } catch (error) {
              console.error('Failed to process ride payment:', error);
              // Don't throw here to avoid webhook retry issues
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
      case 'charge.refunded':
        {
          const charge = event.data.object as Stripe.Charge;
          try {
            await handleRefundSuccess(charge);
          } catch (error) {
            console.error('Failed to process refund:', error);
            // Don't throw here to avoid webhook retry issues
          }
        }
        break;
      case 'charge.dispute.created':
        {
          const dispute = event.data.object as Stripe.Dispute;
          console.warn('Chargeback/dispute created:', dispute.id, 'for charge:', dispute.charge);
          // You might want to handle disputes differently
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



