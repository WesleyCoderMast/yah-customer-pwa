import { Router, Request, Response } from 'express';
import { paymentService, PaymentRequest, PayoutRequest } from './paymentService';
import { supabase } from './db';

const router = Router();

/**
 * Create a payment
 * POST /api/payments/create
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const paymentData: PaymentRequest = req.body;

    // Validate required fields
    if (!paymentData.amount || !paymentData.reference || !paymentData.paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, reference, paymentMethod'
      });
    }

    // Create payment
    const result = await paymentService.createPayment(paymentData);

    if (result.success) {
      // Store payment in database
      const { error } = await supabase
        .from('adyen_payments')
        .insert({
          psp_reference: result.pspReference,
          amount: paymentData.amount.value,
          currency: paymentData.amount.currency,
          reference: paymentData.reference,
          status: result.resultCode,
          payment_method: paymentData.paymentMethod.type,
          shopper_reference: paymentData.shopperReference,
          metadata: paymentData.metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Database error:', error);
      }
    }

    res.json(result);

  } catch (error: any) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment creation failed'
    });
  }
});

/**
 * Create checkout session (for Drop-in/Components)
 * POST /api/payments/session
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { amount, reference, returnUrl, shopperReference, storePaymentMethod, shopperInteraction, recurringProcessingModel, metadata } = req.body;

    if (!amount || !reference || !returnUrl) {
      return res.status(400).json({ success: false, error: 'Missing required fields: amount, reference, returnUrl' });
    }

    const result = await paymentService.createCheckoutSession({
      amount,
      reference,
      returnUrl,
      shopperReference,
      storePaymentMethod,
      shopperInteraction,
      recurringProcessingModel,
      metadata
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create session' });
  }
});

/**
 * Capture a payment
 * POST /api/payments/capture
 */
router.post('/capture', async (req: Request, res: Response) => {
  try {
    const { pspReference, amount } = req.body;

    if (!pspReference || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pspReference, amount'
      });
    }

    const result = await paymentService.capturePayment(pspReference, amount);

    if (result.success) {
      // Update payment status in database
      const { error } = await supabase
        .from('adyen_payments')
        .update({ 
          status: 'Captured',
          captured_at: new Date().toISOString()
        })
        .eq('psp_reference', pspReference);

      if (error) {
        console.error('Database error:', error);
      }
    }

    res.json(result);

  } catch (error: any) {
    console.error('Payment capture error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment capture failed'
    });
  }
});

/**
 * Refund a payment
 * POST /api/payments/refund
 */
router.post('/refund', async (req: Request, res: Response) => {
  try {
    const { pspReference, amount } = req.body;

    if (!pspReference || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pspReference, amount'
      });
    }

    const result = await paymentService.refundPayment(pspReference, amount);

    if (result.success) {
      // Update payment status in database
      const { error } = await supabase
        .from('adyen_payments')
        .update({ 
          status: 'Refunded',
          refunded_at: new Date().toISOString()
        })
        .eq('psp_reference', pspReference);

      if (error) {
        console.error('Database error:', error);
      }
    }

    res.json(result);

  } catch (error: any) {
    console.error('Payment refund error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment refund failed'
    });
  }
});

/**
 * Create instant payout
 * POST /api/payments/payout
 */
router.post('/payout', async (req: Request, res: Response) => {
  try {
    const payoutData: PayoutRequest = req.body;

    // Validate required fields
    if (!payoutData.amount || !payoutData.reference || !payoutData.destination) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, reference, destination'
      });
    }

    const result = await paymentService.createInstantPayout(payoutData);

    if (result.success) {
      // Store payout in database
      const { error } = await supabase
        .from('adyen_payouts')
        .insert({
          psp_reference: result.pspReference,
          amount: payoutData.amount.value,
          currency: payoutData.amount.currency,
          reference: payoutData.reference,
          status: result.resultCode,
          destination_type: payoutData.destination.type,
          description: payoutData.description,
          metadata: payoutData.metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Database error:', error);
      }
    }

    res.json(result);

  } catch (error: any) {
    console.error('Payout creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payout creation failed'
    });
  }
});

/**
 * Process periodic payouts for drivers and CEO
 * POST /api/payments/periodic-payouts
 */
router.post('/periodic-payouts', async (req: Request, res: Response) => {
  try {
    const { payouts } = req.body;

    if (!payouts || !Array.isArray(payouts)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid payouts array'
      });
    }

    const results = await paymentService.processPeriodicPayouts(payouts);

    // Store payout results in database
    for (const result of results) {
      if (result.success) {
        const { error } = await supabase
          .from('adyen_payouts')
          .insert({
            psp_reference: result.pspReference,
            amount: payouts.find((p: any) => p.recipientId === result.recipientId)?.amount.value,
            currency: payouts.find((p: any) => p.recipientId === result.recipientId)?.amount.currency,
            reference: `periodic-${result.recipientType}-${result.recipientId}-${Date.now()}`,
            status: result.resultCode,
            destination_type: 'bankAccount',
            description: `Periodic payout for ${result.recipientType}`,
            metadata: {
              recipientId: result.recipientId,
              recipientType: result.recipientType,
              payoutType: 'periodic'
            },
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('Database error:', error);
        }
      }
    }

    res.json({
      success: true,
      results: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error: any) {
    console.error('Periodic payouts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Periodic payouts failed'
    });
  }
});

/**
 * Get payment status
 * GET /api/payments/status/:pspReference
 */
router.get('/status/:pspReference', async (req: Request, res: Response) => {
  try {
    const { pspReference } = req.params;

    // Get payment from database
    const { data: payment, error } = await supabase
      .from('adyen_payments')
      .select('*')
      .eq('psp_reference', pspReference)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: payment
    });

  } catch (error: any) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment status'
    });
  }
});

/**
 * Get payout status
 * GET /api/payments/payout-status/:pspReference
 */
router.get('/payout-status/:pspReference', async (req: Request, res: Response) => {
  try {
    const { pspReference } = req.params;

    // Get payout from database
    const { data: payout, error } = await supabase
      .from('adyen_payouts')
      .select('*')
      .eq('psp_reference', pspReference)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Payout not found'
      });
    }

    res.json({
      success: true,
      payout: payout
    });

  } catch (error: any) {
    console.error('Get payout status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payout status'
    });
  }
});

/**
 * Get payments by customer
 * GET /api/payments/customer/:customerId
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Get payments from database
    const { data: payments, error } = await supabase
      .from('adyen_payments')
      .select('*')
      .eq('shopper_reference', customerId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get payments'
      });
    }

    res.json({
      success: true,
      payments: payments,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: payments?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Get customer payments error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer payments'
    });
  }
});

/**
 * Get payouts by recipient
 * GET /api/payments/recipient/:recipientId
 */
router.get('/recipient/:recipientId', async (req: Request, res: Response) => {
  try {
    const { recipientId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Get payouts from database
    const { data: payouts, error } = await supabase
      .from('adyen_payouts')
      .select('*')
      .contains('metadata', { recipientId })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get payouts'
      });
    }

    res.json({
      success: true,
      payouts: payouts,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: payouts?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Get recipient payouts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get recipient payouts'
    });
  }
});

/**
 * Webhook endpoint for Adyen notifications
 * POST /api/payments/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('Received webhook:', req.body);

    // Process webhook
    const result = await paymentService.processWebhook(req.body);

    if (result.success) {
      // Store webhook event in database
      const { error } = await supabase
        .from('webhook_events')
        .insert({
          event_type: req.body.eventType,
          psp_reference: req.body.pspReference,
          merchant_account: req.body.merchantAccount,
          event_data: req.body,
          processed: true,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Database error:', error);
      }

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Webhook processing failed'
    });
  }
});

export default router;
