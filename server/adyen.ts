const { Client, CheckoutAPI, EnvironmentEnum } = require('@adyen/api-library');

// Adyen API configuration
const ADYEN_API_KEY = process.env.ADYEN_API_KEY!;
const ADYEN_MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT!;
const ADYEN_ENVIRONMENT = process.env.ADYEN_ENVIRONMENT || 'TEST'; // TEST or LIVE

// Initialize Adyen client
const client = new Client({
  apiKey: ADYEN_API_KEY,
  environment: ADYEN_ENVIRONMENT === 'LIVE' ? EnvironmentEnum.LIVE : EnvironmentEnum.TEST
});

const checkout = new CheckoutAPI(client);

export interface AdyenPaymentRequest {
  amount: {
    value: number; // Amount in minor units (cents)
    currency: string;
  };
  paymentMethod: {
    type: string;
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

      const request = {
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        reference: paymentData.reference,
        merchantAccount: paymentData.merchantAccount,
        returnUrl: paymentData.returnUrl || 'https://your-company-website.com/checkout/return',
        shopperReference: paymentData.shopperReference,
        shopperEmail: paymentData.shopperEmail,
        countryCode: paymentData.countryCode || 'US',
        shopperLocale: paymentData.shopperLocale || 'en_US',
        captureDelayHours: paymentData.capture === false ? 0 : undefined, // 0 = manual capture
      };

      const response = await checkout.payments(request);

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
        modificationAmount: modificationAmount,
        originalReference: pspReference,
        reference: `capture-${pspReference}-${Date.now()}`
      };

      const response = await checkout.paymentsCapture(request);

      console.log('Adyen capture response:', {
        response: response.response,
        pspReference: response.pspReference
      });

      if (response.response === '[capture-received]') {
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
        modificationAmount: modificationAmount,
        originalReference: pspReference,
        reference: `refund-${pspReference}-${Date.now()}`
      };

      const response = await checkout.paymentsRefund(request);

      console.log('Adyen refund response:', {
        response: response.response,
        pspReference: response.pspReference
      });

      if (response.response === '[refund-received]') {
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