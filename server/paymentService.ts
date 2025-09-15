import Adyen from '@adyen/api-library';
import { EnvironmentEnum } from '@adyen/api-library/lib/src/config';
import { ADYEN_API_KEY, ADYEN_MERCHANT_ACCOUNT, ADYEN_ENVIRONMENT } from './config';
import { createAdyenPaymentRequest } from './adyen';

// Initialize Adyen client
const client = new Adyen.Client({
  apiKey: ADYEN_API_KEY,
  environment: ADYEN_ENVIRONMENT === 'LIVE' ? EnvironmentEnum.LIVE : EnvironmentEnum.TEST
});

const checkout = new Adyen.CheckoutAPI(client);
const transfers = new Adyen.TransfersAPI(client);
const payouts = new Adyen.PayoutAPI(client);

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
        reference: `capture-${pspReference}-${Date.now()}`
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
        reference: `refund-${pspReference}-${Date.now()}`
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

      const response = await payouts.storeDetailsAndSubmitThirdParty(request as any);

      console.log('Payout response:', {
        pspReference: response.pspReference,
        resultCode: response.resultCode
      });

      return {
        success: response.resultCode === 'Received',
        pspReference: response.pspReference,
        resultCode: response.resultCode,
        status: response.status,
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

      const response = await transfers.transfers(request as any);

      console.log('Transfer response:', {
        pspReference: response.pspReference,
        status: response.status
      });

      return {
        success: response.status === 'received',
        pspReference: response.pspReference,
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
          reference: `periodic-${payout.recipientType}-${payout.recipientId}-${Date.now()}`,
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
      console.log('Processing webhook:', {
        eventType: webhookData.eventType,
        pspReference: webhookData.pspReference,
        merchantAccount: webhookData.merchantAccount
      });

      const event: WebhookEvent = {
        eventType: webhookData.eventType,
        eventDate: webhookData.eventDate,
        merchantAccount: webhookData.merchantAccount,
        pspReference: webhookData.pspReference,
        originalReference: webhookData.originalReference,
        amount: webhookData.amount,
        success: webhookData.success,
        reason: webhookData.reason,
        additionalData: webhookData.additionalData
      };

      // Process different event types
      switch (event.eventType) {
        case 'AUTHORISATION':
          await this.handleAuthorisationEvent(event);
          break;
        case 'CAPTURE':
          await this.handleCaptureEvent(event);
          break;
        case 'REFUND':
          await this.handleRefundEvent(event);
          break;
        case 'PAYOUT':
          await this.handlePayoutEvent(event);
          break;
        case 'TRANSFER':
          await this.handleTransferEvent(event);
          break;
        default:
          console.log(`Unhandled event type: ${event.eventType}`);
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
    // Update payment status in database
    // Send confirmation email to customer
    // Update ride status if applicable
  }

  /**
   * Handle capture events
   */
  private async handleCaptureEvent(event: WebhookEvent): Promise<void> {
    console.log('Handling capture event:', event.pspReference);
    // Update payment status in database
    // Process driver payout
    // Update ride status to completed
  }

  /**
   * Handle refund events
   */
  private async handleRefundEvent(event: WebhookEvent): Promise<void> {
    console.log('Handling refund event:', event.pspReference);
    // Update payment status in database
    // Send refund confirmation email
    // Update ride status if applicable
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
