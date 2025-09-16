
import Adyen from '@adyen/api-library';
import { EnvironmentEnum } from '@adyen/api-library/lib/src/config';
import { ADYEN_API_KEY, ADYEN_MERCHANT_ACCOUNT, ADYEN_ENVIRONMENT } from './config';

// Adyen API configuration

// Initialize Adyen client
const client = new Adyen.Client({
  apiKey: ADYEN_API_KEY,
  environment: ADYEN_ENVIRONMENT === 'LIVE' ? EnvironmentEnum.LIVE : EnvironmentEnum.TEST
});

const checkout = new Adyen.CheckoutAPI(client);

/**
 * Helper function to create a properly formatted Adyen payment request
 * Based on the official Adyen API documentation
 * 
 * Example usage:
 * const paymentRequest = createAdyenPaymentRequest({
 *   amount: { currency: "USD", value: 1000 },
 *   reference: "Your order number",
 *   paymentMethod: {
 *     type: "scheme",
 *     encryptedCardNumber: "test_4111111111111111",
 *     encryptedExpiryMonth: "test_03",
 *     encryptedExpiryYear: "test_2030",
 *     encryptedSecurityCode: "test_737"
 *   },
 *   shopperReference: "YOUR_UNIQUE_SHOPPER_ID_IOfW3k9G2PvXFu2j",
 *   storePaymentMethod: true,
 *   shopperInteraction: "Ecommerce",
 *   recurringProcessingModel: "CardOnFile",
 *   returnUrl: "https://your-company.com/...",
 *   merchantAccount: "YOUR_MERCHANT_ACCOUNT"
 * });
 */
export function createAdyenPaymentRequest(data: {
  amount: { currency: string; value: number };
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
}): any {
  return {
    amount: data.amount,
    reference: data.reference,
    paymentMethod: data.paymentMethod,
    shopperReference: data.shopperReference,
    storePaymentMethod: data.storePaymentMethod || false,
    shopperInteraction: data.shopperInteraction || 'Ecommerce',
    recurringProcessingModel: data.recurringProcessingModel || 'CardOnFile',
    returnUrl: data.returnUrl || 'https://your-company.com/checkout/return',
    merchantAccount: data.merchantAccount
  };
}

export interface AdyenPaymentRequest {
  amount: {
    value: number; // Amount in minor units (cents)
    currency: string;
  };
  paymentMethod: {
    type: 'scheme' | 'ideal' | 'paypal' | 'applepay' | 'googlepay' | string;
    // For encrypted card data (recommended)
    encryptedCardNumber?: string;
    encryptedExpiryMonth?: string;
    encryptedExpiryYear?: string;
    encryptedSecurityCode?: string;
    // For plain card data (less secure, for testing)
    number?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cvc?: string;
    holderName?: string;
  };
  reference: string;
  merchantAccount: string;
  returnUrl?: string;
  shopperReference?: string;
  shopperEmail?: string;
  countryCode?: string;
  shopperLocale?: string;
  storePaymentMethod?: boolean;
  shopperInteraction?: 'Ecommerce' | 'ContAuth' | 'Moto' | 'POS';
  recurringProcessingModel?: 'CardOnFile' | 'Subscription' | 'UnscheduledCardOnFile';
  capture?: boolean; // For authorization and capture flow
}

export interface AdyenPaymentResult {
  success: boolean;
  pspReference?: string;
  resultCode?: string;
  refusalReason?: string;
  error?: string;
  details?: any;
}

export class AdyenClient {
  /**
   * Create a payment (authorization or direct capture)
   */
  async createPayment(paymentData: AdyenPaymentRequest): Promise<AdyenPaymentResult> {
    try {
      console.log('Creating Adyen payment:', {
        amount: paymentData.amount,
        reference: paymentData.reference,
        capture: paymentData.capture
      });

      const request = createAdyenPaymentRequest({
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        reference: paymentData.reference,
        merchantAccount: paymentData.merchantAccount,
        returnUrl: paymentData.returnUrl,
        shopperReference: paymentData.shopperReference,
        storePaymentMethod: paymentData.storePaymentMethod,
        shopperInteraction: paymentData.shopperInteraction,
        recurringProcessingModel: paymentData.recurringProcessingModel
      });
      console.log(request)
      const idempotency = new Date().getTime().toString();
      const response = await checkout.PaymentsApi.payments(request as any, { idempotencyKey: idempotency });

      console.log('Adyen payment response:', {
        resultCode: response.resultCode,
        pspReference: response.pspReference,
        refusalReason: response.refusalReason
      });

      if (response.resultCode === 'Authorised') {
        return {
          success: true,
          pspReference: response.pspReference,
          resultCode: response.resultCode,
          details: response
        };
      } else {
        return {
          success: false,
          resultCode: response.resultCode,
          refusalReason: response.refusalReason,
          error: response.refusalReason || 'Payment failed',
          details: response
        };
      }
    } catch (error: any) {
      console.error('Adyen payment error:', error);
      return {
        success: false,
        error: error.message || 'Payment processing failed',
        details: error
      };
    }
  }

  /**
   * Capture an authorized payment
   */
  async capturePayment(pspReference: string, modificationAmount: {
    value: number;
    currency: string;
  }): Promise<AdyenPaymentResult> {
    try {
      console.log('Capturing Adyen payment:', {
        pspReference,
        amount: modificationAmount
      });

      const request = {
        merchantAccount: ADYEN_MERCHANT_ACCOUNT,
        amount: modificationAmount,
        originalReference: pspReference,
        reference: `CAP${pspReference.substring(0, 8)}${Date.now().toString().slice(-6)}`
      };

      const response = await checkout.ModificationsApi.captureAuthorisedPayment(pspReference, request);

      console.log('Adyen capture response:', {
        pspReference: response.pspReference,
        status: response.status
      });

      if (response.status === 'received') {
        return {
          success: true,
          pspReference: response.pspReference,
          resultCode: 'Captured',
          details: response
        };
      } else {
        return {
          success: false,
          error: 'Capture failed',
          details: response
        };
      }
    } catch (error: any) {
      console.error('Adyen capture error:', error);
      return {
        success: false,
        error: error.message || 'Capture failed',
        details: error
      };
    }
  }

  /**
   * Cancel or refund a payment
   */
  async refundPayment(pspReference: string, modificationAmount: {
    value: number;
    currency: string;
  }): Promise<AdyenPaymentResult> {
    try {
      console.log('Refunding Adyen payment:', {
        pspReference,
        amount: modificationAmount
      });

      const request = {
        merchantAccount: ADYEN_MERCHANT_ACCOUNT,
        amount: modificationAmount,
        originalReference: pspReference,
        reference: `REF${pspReference.substring(0, 8)}${Date.now().toString().slice(-6)}`
      };

      const response = await checkout.ModificationsApi.refundCapturedPayment(pspReference, request);

      console.log('Adyen refund response:', {
        pspReference: response.pspReference,
        status: response.status
      });

      if (response.status === 'received') {
        return {
          success: true,
          pspReference: response.pspReference,
          resultCode: 'Refunded',
          details: response
        };
      } else {
        return {
          success: false,
          error: 'Refund failed',
          details: response
        };
      }
    } catch (error: any) {
      console.error('Adyen refund error:', error);
      return {
        success: false,
        error: error.message || 'Refund failed',
        details: error
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      // Implement Adyen webhook signature verification
      // This would use Adyen's HMAC signature verification
      // For now, return true (implement proper verification in production)
      console.log('Verifying Adyen webhook signature');
      return true; // TODO: Implement proper verification
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const adyenClient = new AdyenClient();

// Helper function to convert card data to Adyen format
export function formatCardForAdyen(cardData: {
  cardNumber: string;
  expiryDate: string; // MM/YY format
  securityCode: string;
  cardHolderName: string;
}) {
  const [month, year] = cardData.expiryDate.split('/');
  
  return {
    type: 'scheme', // Adyen's term for card payments
    number: cardData.cardNumber.replace(/\s+/g, ''),
    expiryMonth: month.padStart(2, '0'),
    expiryYear: `20${year}`,
    cvc: cardData.securityCode,
    holderName: cardData.cardHolderName
  };
}

// Helper function to convert amount to minor units (cents)
export function convertToMinorUnits(amount: number, currency: string): number {
  // Most currencies use 2 decimal places (cents)
  // Some currencies like JPY use 0 decimal places
  const decimalPlaces = ['JPY', 'KRW', 'CLP'].includes(currency.toUpperCase()) ? 0 : 2;
  return Math.round(amount * Math.pow(10, decimalPlaces));
}