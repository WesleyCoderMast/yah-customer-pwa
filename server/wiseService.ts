import { ADYEN_MERCHANT_ACCOUNT, ADYEN_SUCCESS_RETURN_URL } from './config';

export interface CardPaymentRequest {
  amount: number;
  currency: string;
  cardNumber: string;
  expiryDate: string;
  securityCode: string;
  cardHolderName: string;
  billingAddress: {
    country: string;
    postalCode: string;
  };
  description: string;
  reference: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  error?: string;
  details?: any;
}

class WiseService {
  
  /**
   * Process a card payment for a ride booking using Adyen
   */
  async processCardPayment(paymentData: CardPaymentRequest): Promise<PaymentResult> {
    try {
      console.log('Processing Adyen payment:', {
        amount: paymentData.amount,
        currency: paymentData.currency,
        cardHolder: paymentData.cardHolderName,
        reference: paymentData.reference
      });

      // Import Adyen client and helpers
      const { adyenClient, formatCardForAdyen, convertToMinorUnits } = await import('./adyen');

      // Get merchant account from hardcoded config

      if (!ADYEN_MERCHANT_ACCOUNT) {
        throw new Error('ADYEN_MERCHANT_ACCOUNT environment variable is required');
      }

      // Format card data for Adyen
      const paymentMethod = formatCardForAdyen({
        cardNumber: paymentData.cardNumber,
        expiryDate: paymentData.expiryDate,
        securityCode: paymentData.securityCode,
        cardHolderName: paymentData.cardHolderName
      });

      // Convert amount to minor units (cents)
      const amountValue = convertToMinorUnits(paymentData.amount, paymentData.currency);

      console.log('Step 1: Creating Adyen payment authorization...');
      console.log(ADYEN_MERCHANT_ACCOUNT)
      console.log(paymentMethod)
      // Step 1: Create payment authorization (capture: false)
      const adyenPayment = await adyenClient.createPayment({
        amount: {
          value: paymentData.amount,
          currency: paymentData.currency
        },
        paymentMethod: paymentMethod,
        reference: paymentData.reference,
        merchantAccount: ADYEN_MERCHANT_ACCOUNT,
        countryCode: paymentData.billingAddress.country || 'US',
        capture: false, // Only authorize, don't capture yet
        returnUrl: ADYEN_SUCCESS_RETURN_URL,
      });

      if (adyenPayment.success && adyenPayment.pspReference) {
        const pspReference = adyenPayment.pspReference;
        console.log('Step 2: Capturing authorized payment:', pspReference);
        
        // Step 2: Capture the authorized payment
        const captureResult = await adyenClient.capturePayment(pspReference, {
          value: amountValue,
          currency: paymentData.currency
        });

        if (captureResult.success) {
          return {
            success: true,
            paymentId: pspReference,
            transactionId: pspReference,
            details: {
              id: pspReference,
              amount: paymentData.amount,
              currency: paymentData.currency,
              status: 'completed',
              reference: paymentData.reference,
              processedAt: new Date().toISOString(),
              authorizationData: adyenPayment.details,
              captureData: captureResult.details
            }
          };
        } else {
          return {
            success: false,
            error: `Payment capture failed: ${captureResult.error || 'Unknown error'}`,
            details: { authorization: adyenPayment, capture: captureResult }
          };
        }
      } else {
        return {
          success: false,
          error: `Payment authorization failed: ${adyenPayment.error || adyenPayment.refusalReason || 'Unknown error'}`,
          details: adyenPayment
        };
      }

    } catch (error: any) {
      console.error('Adyen payment processing error:', error);
      
      return {
        success: false,
        error: 'Payment processing failed: ' + (error.message || 'Unknown error'),
        details: error
      };
    }
  }

  /**
   * Get payment status (Mock implementation)
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    try {
      // Mock payment status retrieval
      return {
        success: true,
        paymentId: paymentId,
        details: {
          id: paymentId,
          status: 'completed',
          retrievedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Error fetching payment status:', error);
      return {
        success: false,
        error: 'Failed to fetch payment status'
      };
    }
  }

  /**
   * Process refund for a ride payment (Mock implementation)
   */
  async processRefund(paymentId: string, amount: number, reason: string): Promise<PaymentResult> {
    try {
      // Generate mock refund ID
      const refundId = `mock_refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Simulate refund processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        paymentId: refundId,
        details: {
          id: refundId,
          originalPaymentId: paymentId,
          amount: amount,
          reason: reason,
          status: 'completed',
          processedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Refund processing error:', error);
      return {
        success: false,
        error: 'Refund processing failed'
      };
    }
  }
}

export const wiseService = new WiseService();