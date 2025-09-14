// Simple payment service without Stripe integration

export interface PaymentMethodData {
  type: 'credit_card' | 'debit_card' | 'apple_pay' | 'google_pay';
  card?: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  };
  billing_details?: {
    name: string;
    email?: string;
    phone?: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export interface RidePayment {
  rideId: string;
  amount: number;
  tip?: number;
  paymentMethodId: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export class PaymentService {
  async initialize(): Promise<boolean> {
    // Simple initialization without external payment providers
    console.log('Payment service initialized (mock implementation)');
    return true;
  }

  async createPaymentMethod(data: PaymentMethodData): Promise<any> {
    try {
      // Mock payment method creation
      const paymentMethod = {
        id: `pm_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: data.type,
        card: data.card ? {
          last4: data.card.number.slice(-4),
          brand: this.detectCardBrand(data.card.number),
          exp_month: data.card.exp_month,
          exp_year: data.card.exp_year,
        } : undefined,
        billing_details: data.billing_details,
        created: Date.now(),
      };

      return paymentMethod;
    } catch (error) {
      console.error('Failed to create payment method:', error);
      throw error;
    }
  }

  async processRidePayment(payment: RidePayment): Promise<PaymentResult> {
    try {
      // Mock payment processing
      console.log('Processing ride payment:', payment);
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock successful payment
      return {
        success: true,
        paymentId: `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      };
    } catch (error) {
      console.error('Failed to process ride payment:', error);
      return {
        success: false,
        error: 'Payment processing failed',
      };
    }
  }

  async setupApplePay(): Promise<boolean> {
    // Mock Apple Pay availability check
    return !!(window as any).ApplePaySession && (window as any).ApplePaySession.canMakePayments();
  }

  async setupGooglePay(): Promise<boolean> {
    // Mock Google Pay availability check
    return 'google' in window && 'payments' in (window as any).google;
  }

  private detectCardBrand(cardNumber: string): string {
    const number = cardNumber.replace(/\s/g, '');
    
    if (number.match(/^4/)) return 'visa';
    if (number.match(/^5[1-5]/)) return 'mastercard';
    if (number.match(/^3[47]/)) return 'amex';
    if (number.match(/^6011|^644|^65/)) return 'discover';
    
    return 'unknown';
  }
}

// Fare calculation utilities
export const calculateBaseFare = (distance: number): number => {
  const baseFare = 2.50;
  const perMile = 1.75;
  return baseFare + (distance * perMile);
};

export const calculateSurgePricing = (baseFare: number, surgeMultiplier: number = 1.0): number => {
  return baseFare * surgeMultiplier;
};

export const calculateEstimatedTotal = (
  baseFare: number, 
  tip: number = 0, 
  taxes: number = 0,
  fees: number = 0
): number => {
  return baseFare + tip + taxes + fees;
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// Create default instance
export const paymentService = new PaymentService();