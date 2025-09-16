import Adyen from '@adyen/api-library';
import { EnvironmentEnum } from '@adyen/api-library/lib/src/config';
import { ADYEN_API_KEY, ADYEN_MERCHANT_ACCOUNT, ADYEN_ENVIRONMENT, ADYEN_HMAC_KEY } from './config';
import crypto from 'crypto';
import { createAdyenPaymentRequest } from './adyen';
import { supabase } from './db';

// Initialize Adyen client
const client = new Adyen.Client({
  apiKey: ADYEN_API_KEY,
  environment: ADYEN_ENVIRONMENT === 'LIVE' ? EnvironmentEnum.LIVE : EnvironmentEnum.TEST
});

const checkout = new Adyen.CheckoutAPI(client);
const transfers = new Adyen.TransfersAPI(client);
const payouts = new Adyen.PayoutAPI(client);
const paymentLinks = checkout.PaymentLinksApi;

// Payment types and interfaces
export interface PaymentRequest {
  amount: {
    currency: string;
    value: number; // Amount in minor units (cents)
  };
  reference: string;
  paymentMethod: {
    type: string;
    encryptedCardNumber?: string;
    encryptedExpiryMonth?: string;
    encryptedExpiryYear?: string;
    encryptedSecurityCode?: string;
    number?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cvc?: string;
    holderName?: string;
  };
  shopperReference?: string;
  storePaymentMethod?: boolean;
  shopperInteraction?: 'Ecommerce' | 'ContAuth' | 'Moto' | 'POS';
  recurringProcessingModel?: 'CardOnFile' | 'Subscription' | 'UnscheduledCardOnFile';
  returnUrl?: string;
  merchantAccount: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  pspReference?: string;
  resultCode?: string;
  refusalReason?: string;
  details?: any;
  error?: string;
}

export interface PayoutRequest {
  amount: {
    currency: string;
    value: number;
  };
  reference: string;
  destination: {
    type: 'bankAccount' | 'card' | 'wallet';
    bankAccount?: {
      accountNumber: string;
      bankCode: string;
      countryCode: string;
      ownerName: string;
    };
    card?: {
      number: string;
      expiryMonth: string;
      expiryYear: string;
      holderName: string;
    };
    wallet?: {
      walletId: string;
      walletType: string;
    };
  };
  merchantAccount: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PayoutResult {
  success: boolean;
  pspReference?: string;
  resultCode?: string;
  status?: string;
  details?: any;
  error?: string;
}

// Payment Link interfaces
export interface PaymentLinkRequest {
  merchantAccount: string;
  reference: string;
  amount: {
    currency: string;
    value: number; // Amount in minor units (cents)
  };
  description?: string;
  shopperLocale?: string;
  expiresAt?: Date; // Date object
  allowedPaymentMethods?: string[];
  blockedPaymentMethods?: string[];
  metadata?: Record<string, string>;
}

export interface PaymentLinkResult {
  success: boolean;
  id?: string;
  url?: string;
  expiresAt?: Date;
  error?: string;
}

export interface WebhookEvent {
  eventType: string;
  eventDate: string;
  merchantAccount: string;
  pspReference: string;
  originalReference?: string;
  amount?: {
    currency: string;
    value: number;
  };
  success: boolean;
  reason?: string;
  additionalData?: Record<string, string>;
}

// Payment Service Class
export class PaymentService {
  private merchantAccount: string;

  constructor(merchantAccount: string = ADYEN_MERCHANT_ACCOUNT) {
    this.merchantAccount = merchantAccount;
  }

  /**
   * Create Adyen Payment Link
   */
  async createPaymentLink(input: PaymentLinkRequest): Promise<PaymentLinkResult> {
    try {
      console.log('Creating payment link:', input);

      const request = {
        merchantAccount: input.merchantAccount,
        reference: input.reference,
        amount: input.amount,
        description: input.description,
        shopperLocale: input.shopperLocale || 'en_US',
        expiresAt: input.expiresAt,
        allowedPaymentMethods: input.allowedPaymentMethods,
        blockedPaymentMethods: input.blockedPaymentMethods,
        metadata: input.metadata
      };

      const response = await paymentLinks.paymentLinks(request);

      console.log('Payment link created:', {
        id: response.id,
        url: response.url,
        expiresAt: response.expiresAt
      });

      return {
        success: true,
        id: response.id,
        url: response.url,
        expiresAt: response.expiresAt
      };

    } catch (error: any) {
      console.error('Payment link creation error:', error);
      return {
        success: false,
        error: error.message || 'Payment link creation failed'
      };
    }
  }

  /**
   * Create Adyen Checkout session (for Drop-in/Components)
   */
  async createCheckoutSession(input: {
    amount: { currency: string; value: number };
    reference: string;
    returnUrl: string;
    shopperReference?: string;
    storePaymentMethod?: boolean;
    shopperInteraction?: 'Ecommerce' | 'ContAuth' | 'Moto' | 'POS';
    recurringProcessingModel?: 'CardOnFile' | 'Subscription' | 'UnscheduledCardOnFile';
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; session?: any; error?: string }> {
    try {
      const request = {
        amount: input.amount,
        reference: input.reference,
        returnUrl: input.returnUrl,
        merchantAccount: this.merchantAccount,
        shopperReference: input.shopperReference,
        storePaymentMethod: input.storePaymentMethod,
        shopperInteraction: input.shopperInteraction || 'Ecommerce',
        recurringProcessingModel: input.recurringProcessingModel || 'CardOnFile',
        metadata: input.metadata
      } as any;

      const idempotency = String(Date.now());
      const session = await checkout.PaymentsApi.sessions(request, { idempotencyKey: idempotency });
      return { success: true, session };
    } catch (error: any) {
      console.error('Create checkout session error:', error);
      return { success: false, error: error.message || 'Failed to create checkout session' };
    }
  }

  /**
   * Create a payment
   */
  async createPayment(paymentData: PaymentRequest): Promise<PaymentResult> {
    try {
      console.log('Creating payment:', {
        amount: paymentData.amount,
        reference: paymentData.reference,
        merchantAccount: this.merchantAccount
      });

      const request = createAdyenPaymentRequest({
        ...paymentData,
        merchantAccount: this.merchantAccount
      });

      console.log('Payment request:', request);
      
      const idempotency = new Date().getTime().toString();
      const response = await checkout.PaymentsApi.payments(request as any, { 
        idempotencyKey: idempotency 
      });

      console.log('Payment response:', {
        resultCode: response.resultCode,
        pspReference: response.pspReference,
        refusalReason: response.refusalReason
      });

      return {
        success: response.resultCode === 'Authorised' || response.resultCode === 'Received',
        pspReference: response.pspReference,
        resultCode: response.resultCode,
        refusalReason: response.refusalReason,
        details: response
      };

    } catch (error: any) {
      console.error('Payment creation error:', error);
      return {
        success: false,
        error: error.message || 'Payment creation failed'
      };
    }
  }

  /**
   * Capture an authorized payment
   */
  async capturePayment(pspReference: string, amount: { currency: string; value: number }): Promise<PaymentResult> {
    try {
      console.log('Capturing payment:', { pspReference, amount });

      const request = {
        merchantAccount: this.merchantAccount,
        amount: amount,
        originalReference: pspReference,
        reference: `CAP${pspReference.substring(0, 8)}${Date.now().toString().slice(-6)}`
      };

      const response = await checkout.ModificationsApi.captureAuthorisedPayment(pspReference, request);

      console.log('Capture response:', {
        pspReference: response.pspReference,
        status: response.status
      });

      return {
        success: response.status === 'received',
        pspReference: response.pspReference,
        resultCode: 'Captured',
        details: response
      };

    } catch (error: any) {
      console.error('Payment capture error:', error);
      return {
        success: false,
        error: error.message || 'Payment capture failed'
      };
    }
  }

  /**
   * Refund a captured payment
   */
  async refundPayment(pspReference: string, amount: { currency: string; value: number }): Promise<PaymentResult> {
    try {
      console.log('Refunding payment:', { pspReference, amount });

      const request = {
        merchantAccount: this.merchantAccount,
        amount: amount,
        originalReference: pspReference,
        reference: `REF${pspReference.substring(0, 8)}${Date.now().toString().slice(-6)}`
      };

      const response = await checkout.ModificationsApi.refundCapturedPayment(pspReference, request);

      console.log('Refund response:', {
        pspReference: response.pspReference,
        status: response.status
      });

      return {
        success: response.status === 'received',
        pspReference: response.pspReference,
        resultCode: 'Refunded',
        details: response
      };

    } catch (error: any) {
      console.error('Payment refund error:', error);
      return {
        success: false,
        error: error.message || 'Payment refund failed'
      };
    }
  }

  /**
   * Create an instant payout to driver or CEO
   */
  async createInstantPayout(payoutData: PayoutRequest): Promise<PayoutResult> {
    try {
      console.log('Creating instant payout:', {
        amount: payoutData.amount,
        reference: payoutData.reference,
        destination: payoutData.destination.type
      });

      const request = {
        amount: payoutData.amount,
        reference: payoutData.reference,
        destination: payoutData.destination,
        merchantAccount: this.merchantAccount,
        description: payoutData.description || 'Instant payout',
        metadata: payoutData.metadata
      };

      const response = await payouts.InitializationApi.storeDetailAndSubmitThirdParty(request as any);

      console.log('Payout response:', {
        pspReference: response.pspReference,
        resultCode: response.resultCode
      });

      return {
        success: response.resultCode === 'Received',
        pspReference: response.pspReference,
        resultCode: response.resultCode,
        details: response
      };

    } catch (error: any) {
      console.error('Instant payout error:', error);
      return {
        success: false,
        error: error.message || 'Instant payout failed'
      };
    }
  }

  /**
   * Create a transfer between accounts (for internal transfers)
   */
  async createTransfer(transferData: {
    amount: { currency: string; value: number };
    reference: string;
    source: { account: string };
    destination: { account: string };
    description?: string;
  }): Promise<PayoutResult> {
    try {
      console.log('Creating transfer:', {
        amount: transferData.amount,
        reference: transferData.reference,
        source: transferData.source.account,
        destination: transferData.destination.account
      });

      const request = {
        amount: transferData.amount,
        reference: transferData.reference,
        source: transferData.source,
        destination: transferData.destination,
        description: transferData.description || 'Internal transfer'
      };

      const response = await transfers.TransfersApi.transferFunds(request as any);

      console.log('Transfer response:', {
        reference: response.reference,
        status: response.status
      });

      return {
        success: response.status === 'received',
        pspReference: response.reference,
        resultCode: 'Transferred',
        status: response.status,
        details: response
      };

    } catch (error: any) {
      console.error('Transfer error:', error);
      return {
        success: false,
        error: error.message || 'Transfer failed'
      };
    }
  }

  /**
   * Process automatic periodic payouts for drivers and CEO
   */
  async processPeriodicPayouts(payouts: Array<{
    recipientId: string;
    recipientType: 'driver' | 'ceo';
    amount: { currency: string; value: number };
    bankAccount: {
      accountNumber: string;
      bankCode: string;
      countryCode: string;
      ownerName: string;
    };
    description?: string;
  }>): Promise<Array<PayoutResult & { recipientId: string; recipientType: string }>> {
    const results: Array<PayoutResult & { recipientId: string; recipientType: string }> = [];

    console.log(`Processing ${payouts.length} periodic payouts`);

    for (const payout of payouts) {
      try {
        const payoutRequest: PayoutRequest = {
          amount: payout.amount,
          reference: `PER${payout.recipientType.substring(0, 3)}${payout.recipientId.substring(0, 8)}${Date.now().toString().slice(-6)}`,
          destination: {
            type: 'bankAccount',
            bankAccount: payout.bankAccount
          },
          merchantAccount: this.merchantAccount,
          description: payout.description || `Periodic payout for ${payout.recipientType}`,
          metadata: {
            recipientId: payout.recipientId,
            recipientType: payout.recipientType,
            payoutType: 'periodic'
          }
        };

        const result = await this.createInstantPayout(payoutRequest);
        
        results.push({
          ...result,
          recipientId: payout.recipientId,
          recipientType: payout.recipientType
        });

        // Add delay between payouts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`Payout error for ${payout.recipientId}:`, error);
        results.push({
          success: false,
          error: error.message || 'Payout failed',
          recipientId: payout.recipientId,
          recipientType: payout.recipientType
        });
      }
    }

    console.log(`Completed ${payouts.length} periodic payouts`);
    return results;
  }

  /**
   * Process webhook events
   */
  async processWebhook(webhookData: any): Promise<{ success: boolean; message: string }> {
    try {
      // Optional HMAC validation for classic payloads
      const validateHmac = (payload: any): boolean => {
        try {
          const item = payload.NotificationRequestItem || payload;
          const sig = item.additionalData?.hmacSignature;
          if (!sig || !ADYEN_HMAC_KEY) return true; // skip if not configured

          // Build signing data per Adyen docs (classic notifications)
          const fields = [
            item.pspReference || '',
            item.originalReference || '',
            item.merchantAccountCode || item.merchantAccount || '',
            item.merchantReference || '',
            String(item.amount?.value ?? ''),
            item.amount?.currency || '',
            item.eventCode || item.eventType || '',
            String(item.success ?? '').toLowerCase(),
          ];
          const signingString = fields.map(v => v.replace(/\\:/g, '\\:')).join(':');
          const key = Buffer.from(ADYEN_HMAC_KEY, 'hex');
          const expected = crypto.createHmac('sha256', key).update(signingString, 'utf8').digest('base64');
          return expected === sig;
        } catch (e) {
          console.warn('HMAC validation error (skipping):', (e as any)?.message);
          return true; // do not block on validation errors
        }
      };

      if (Array.isArray(webhookData?.notificationItems)) {
        for (const item of webhookData.notificationItems) {
          if (!validateHmac(item)) {
            console.warn('Invalid HMAC signature for notification item');
            continue; // skip invalid item but acknowledge overall
          }
        }
      } else if (!validateHmac(webhookData)) {
        console.warn('Invalid HMAC signature for webhook');
        return { success: true, message: 'Invalid HMAC (acknowledged)' };
      }
      const handleSingle = async (payload: any) => {
        const eventTypeRaw = payload.eventType || payload.eventCode || 'UNKNOWN';
        const eventType = String(eventTypeRaw).toUpperCase();
        const pspReference = payload.pspReference || payload.pspreference || payload.Pspreference;
        const originalReference = payload.originalReference || payload.originalpspreference;
        const success = typeof payload.success === 'boolean' ? payload.success : String(payload.success).toLowerCase() === 'true';

        const normalized: WebhookEvent = {
          eventType,
          eventDate: payload.eventDate || new Date().toISOString(),
          merchantAccount: payload.merchantAccount || payload.merchantaccount,
          pspReference,
          originalReference,
          amount: payload.amount || (payload.amountValue && payload.amountCurrency ? { value: payload.amountValue, currency: payload.amountCurrency } : undefined),
          success,
          reason: payload.reason,
          additionalData: payload.additionalData || payload.additionalDataJson,
        };

        switch (normalized.eventType) {
          case 'AUTHORISATION':
            await this.handleAuthorisationEvent(normalized);
            break;
          case 'CAPTURE':
            await this.handleCaptureEvent(normalized);
            break;
          case 'REFUND':
            await this.handleRefundEvent(normalized);
            break;
          default:
            console.log(`Unhandled event type: ${normalized.eventType}`);
        }
      };

      if (Array.isArray(webhookData?.notificationItems)) {
        for (const item of webhookData.notificationItems) {
          await handleSingle(item.NotificationRequestItem || item);
        }
      } else {
        await handleSingle(webhookData);
      }

      return { success: true, message: 'Webhook processed successfully' };

    } catch (error: any) {
      console.error('Webhook processing error:', error);
      return { success: false, message: error.message || 'Webhook processing failed' };
    }
  }

  /**
   * Handle authorisation events
   */
  private async handleAuthorisationEvent(event: WebhookEvent): Promise<void> {
    console.log('Handling authorisation event:', event.pspReference);
    
    if (event.success) {
      const paymentLinkId = (event.additionalData as any)?.paymentLinkId;
      const lookupRef = paymentLinkId || event.pspReference;
      // Update payment status in database
      const { error: paymentError } = await supabase
        .from('adyen_payments')
        .update({
          status: 'Authorised',
          psp_reference: lookupRef,
          updated_at: new Date().toISOString()
        })
        .eq('psp_reference', lookupRef);

      if (paymentError) {
        console.error('Error updating payment record:', paymentError);
      }

      // Try to find and update the associated ride
      if (lookupRef) {
        // Payment link payment: map to ride and driver, set ride accepted
        const { data: paymentData } = await supabase
          .from('adyen_payments')
          .select('reference, metadata, ride_id, driver_id')
          .eq('psp_reference', lookupRef)
          .single();

        const rideId = paymentData?.ride_id;
        const driverId = paymentData?.driver_id;
        console.log('******************* here is update riding ********************');
        console.log(paymentData);
        if (rideId && driverId) {
          const { error: rideError } = await supabase
            .from('rides')
            .update({
              status: 'accepted',
              driver_id: driverId,
              accepted_at: new Date().toISOString()
            })
            .eq('id', rideId);

          if (rideError) {
            console.error('Error updating ride to accepted:', rideError);
          } else {
            console.log(`Updated ride ${rideId} to accepted with driver ${driverId}`);
            // Create chat session between customer and driver for this ride
          }
        }
      }
    }
  }

  /**
   * Handle capture events
   */
  private async handleCaptureEvent(event: WebhookEvent): Promise<void> {
    console.log('Handling capture event:', event.pspReference);
    const paymentLinkId = (event.additionalData as any)?.paymentLinkId;
    const lookupRef = paymentLinkId || event.pspReference;
    // Update payment status in database
    const { error: paymentError } = await supabase
      .from('adyen_payments')
      .update({
        status: 'Captured',
        psp_reference: lookupRef,
        updated_at: new Date().toISOString()
      })
      .eq('psp_reference', lookupRef);

    if (paymentError) {
      console.error('Error updating payment (capture):', paymentError);
    }

    // Map to ride and complete it
    const { data: paymentData } = await supabase
      .from('adyen_payments')
      .select('metadata')
      .eq('psp_reference', lookupRef)
      .single();

    const rideId = paymentData?.metadata?.rideId;
    if (rideId) {
      const { error: rideError } = await supabase
        .from('rides')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', rideId);
      if (rideError) {
        console.error('Error updating ride (capture):', rideError);
      }
    }
  }

  /**
   * Handle refund events
   */
  private async handleRefundEvent(event: WebhookEvent): Promise<void> {
    console.log('Handling refund event:', event.pspReference);
    const paymentLinkId = (event.additionalData as any)?.paymentLinkId;
    const lookupRef = paymentLinkId || event.pspReference;
    // Update payment status in database
    const { error: paymentError } = await supabase
      .from('adyen_payments')
      .update({
        status: 'Refunded',
        updated_at: new Date().toISOString()
      })
      .eq('psp_reference', lookupRef);

    if (paymentError) {
      console.error('Error updating payment (refund):', paymentError);
    }

    // Optional: mark ride as refunded note (keep completed status)
    const { data: paymentData } = await supabase
      .from('adyen_payments')
      .select('metadata')
      .eq('psp_reference', lookupRef)
      .single();

    const rideId = paymentData?.metadata?.rideId;
    if (rideId) {
      await supabase
        .from('rides')
        .update({ /* add refund annotation column later if needed */ })
        .eq('id', rideId);
    }
  }

  /**
   * Handle payout events
   */
  private async handlePayoutEvent(event: WebhookEvent): Promise<void> {
    console.log('Handling payout event:', event.pspReference);
    // Update payout status in database
    // Send payout confirmation to recipient
    // Update driver/CEO balance
  }

  /**
   * Handle transfer events
   */
  private async handleTransferEvent(event: WebhookEvent): Promise<void> {
    console.log('Handling transfer event:', event.pspReference);
    // Update transfer status in database
    // Update account balances
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
