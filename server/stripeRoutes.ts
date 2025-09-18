import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from './config';

const router = Router();

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Keep client-side publishable key in frontend config

router.post('/create-payment-intent', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'usd', metadata } = req.body as { amount: number; currency?: string; metadata?: Record<string, string> };

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount (in cents) is required' });
    }

    const user = (req as any).user as { id?: string } | undefined;
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        rideId: (metadata as any)?.rideId,
        requestId: (metadata as any)?.requestId,
        customerId: user?.id ?? null,
      },
    });

    const clientSecret: string | null = paymentIntent.client_secret ?? null;
    res.json({ clientSecret });
  } catch (error: any) {
    console.error('Stripe create-payment-intent error:', error);
    res.status(500).json({ message: error.message || 'Failed to create PaymentIntent' });
  }
});

export default router;


