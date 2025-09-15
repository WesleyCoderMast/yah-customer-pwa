import crypto from "crypto";
const log = false;

// Rapyd API configuration
const RAPYD_BASE_URL = "https://sandboxapi.rapyd.net";
// const RAPYD_BASE_URL = "https://api.rapyd.net";
import { RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY } from './config';

// Generate Rapyd API signature (following official tutorial)
function generateSignature(
  httpMethod: string,
  urlPath: string,
  salt: string,
  timestamp: string,
  body: string = "",
): string {
  const toSign =
    httpMethod.toLowerCase() +
    urlPath +
    salt +
    timestamp +
    RAPYD_ACCESS_KEY +
    RAPYD_SECRET_KEY +
    body;

  const hash = crypto.createHmac("sha256", RAPYD_SECRET_KEY);
  hash.update(toSign);
  return Buffer.from(hash.digest("hex")).toString("base64");
}

// Make authenticated request to Rapyd API
async function rapydRequest(
  method: string,
  path: string,
  body?: any,
): Promise<any> {
  const salt = crypto.randomBytes(8).toString("hex");
  const timestamp = Math.round(new Date().getTime() / 1000).toString();

  // Apply Rapyd-specific body formatting (following official tutorial)
  let bodyString = "";
  if (body) {
    bodyString = JSON.stringify(body);
    bodyString = bodyString === "{}" ? "" : bodyString;
  }

  console.log("Rapyd request debug:", {
    method,
    path,
    bodyString,
    timestamp,
    salt,
  });
  const url = `${RAPYD_BASE_URL}${path}`;

  const signature = generateSignature(
    method,
    path,
    salt,
    timestamp,
    bodyString,
  );
  const idempotency = new Date().getTime().toString();
  const headers = {
    "Content-Type": "application/json",
    access_key: RAPYD_ACCESS_KEY,
    salt: salt,
    timestamp: timestamp,
    signature: signature,
    idempotency: idempotency,
  };

  console.log("Rapyd signature debug:", {
    toSign:
      method.toLowerCase() +
      path +
      salt +
      timestamp +
      RAPYD_ACCESS_KEY +
      RAPYD_SECRET_KEY +
      bodyString,
    signature,
  });

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: bodyString || undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Rapyd API response error:", data);
      throw new Error(
        `Rapyd API Error: ${data.status?.message || "Unknown error"}`,
      );
    }

    return data;
  } catch (error) {
    console.error("Rapyd API request failed:", error);
    throw error;
  }
}

// Rapyd API client class
export class RapydClient {
  // Create a beneficiary (for drivers and CEO)
  async createBeneficiary(beneficiaryData: {
    merchant_reference_id: string;
    category: "bank" | "card" | "ewallet";
    country: string;
    currency: string;
    entity_type: "individual" | "company";
    first_name?: string;
    last_name?: string;
    company_name?: string;
    phone_number?: string;
    email?: string;
    address?: {
      name: string;
      line_1: string;
      city: string;
      state?: string;
      country: string;
      zip?: string;
    };
    bank_details?: {
      account_number: string;
      routing_number?: string;
      iban?: string;
      bic_swift?: string;
      bank_name?: string;
    };
  }) {
    return await rapydRequest(
      "POST",
      "/v1/payouts/beneficiary",
      beneficiaryData,
    );
  }

  // Get beneficiary details
  async getBeneficiary(beneficiaryId: string) {
    return await rapydRequest(
      "GET",
      `/v1/payouts/beneficiary/${beneficiaryId}`,
    );
  }

  // Create a payment method (tokenize card details)
  async createPaymentMethod(paymentMethodData: {
    type: string;
    fields: {
      number: string;
      expiration_month: string;
      expiration_year: string;
      cvv: string;
      name: string;
    };
    metadata?: any;
  }) {
    return await rapydRequest("POST", "/v1/payment_methods", paymentMethodData);
  }

  // Create a payment using a payment method (authorization only)
  async createPayment(paymentData: {
    amount: number;
    currency: string;
    payment_method: string; // Payment method ID (not object)
    merchant_reference_id: string;
    description?: string;
    capture?: boolean;
  }) {
    return await rapydRequest("POST", "/v1/payments", paymentData);
  }

  // Capture an authorized payment
  async capturePayment(
    paymentId: string,
    captureData?: {
      amount?: number;
      receipt_email?: string;
    },
  ) {
    return await rapydRequest(
      "POST",
      `/v1/payments/${paymentId}/capture`,
      captureData || {},
    );
  }

  // Create a payout to beneficiary
  async createPayout(payoutData: {
    beneficiary: string;
    sender_currency: string;
    payout_currency?: string;
    amount: number;
    payout_method_type: string;
    merchant_reference_id: string;
    description?: string;
    payout_options?: any;
  }) {
    return await rapydRequest("POST", "/v1/payouts", payoutData);
  }

  // Get payout status
  async getPayout(payoutId: string) {
    return await rapydRequest("GET", `/v1/payouts/${payoutId}`);
  }

  // List payment methods for a country
  async getPaymentMethods(country: string, currency?: string) {
    const query = currency
      ? `?country=${country}&currency=${currency}`
      : `?country=${country}`;
    return await rapydRequest("GET", `/v1/payment_methods/country${query}`);
  }

  // Get supported countries for payouts
  async getPayoutCountries() {
    return await rapydRequest("GET", "/v1/payouts/supported_types");
  }

  // Test authentication with a simple endpoint
  async testAuthentication() {
    return await rapydRequest("GET", "/v1/countries");
  }

  // Calculate FX rates
  async getFXRates(fromCurrency: string, toCurrency: string, amount?: number) {
    const query = amount
      ? `?buy_currency=${toCurrency}&sell_currency=${fromCurrency}&amount=${amount}`
      : `?buy_currency=${toCurrency}&sell_currency=${fromCurrency}`;
    return await rapydRequest("GET", `/v1/rates/daily${query}`);
  }

  // Webhook signature verification
  verifyWebhookSignature(
    body: string,
    signature: string,
    salt: string,
    timestamp: string,
  ): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", RAPYD_SECRET_KEY)
      .update(salt + timestamp + RAPYD_ACCESS_KEY + RAPYD_SECRET_KEY + body)
      .digest("hex");

    return signature === expectedSignature;
  }
}

// Export singleton instance
export const rapydClient = new RapydClient();

// Helper functions for Yah-specific operations

// Create driver beneficiary during onboarding
export async function createDriverBeneficiary(driverData: {
  driverId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  bankDetails: {
    accountNumber: string;
    routingNumber?: string;
    bankName?: string;
  };
}) {
  return await rapydClient.createBeneficiary({
    merchant_reference_id: `driver_${driverData.driverId}`,
    category: "bank",
    country: driverData.country,
    currency: driverData.currency,
    entity_type: "individual",
    first_name: driverData.firstName,
    last_name: driverData.lastName,
    email: driverData.email,
    phone_number: driverData.phone,
    bank_details: {
      account_number: driverData.bankDetails.accountNumber,
      routing_number: driverData.bankDetails.routingNumber,
      bank_name: driverData.bankDetails.bankName,
    },
  });
}

// Create CEO beneficiary (Wise account)
export async function createCeoBeneficiary() {
  return await rapydClient.createBeneficiary({
    merchant_reference_id: "yah_ceo_wise",
    category: "bank",
    country: "US", // Adjust based on CEO's location
    currency: "USD",
    entity_type: "company",
    company_name: "Yah Global Mobility LLC",
    // Add Wise bank details here when available
  });
}

// Process ride payment collection (collect to platform)
export async function processRidePayment(rideData: {
  rideId: string;
  totalAmount: number;
  currency: string;
  paymentMethod: any;
  customerId: string;
}) {
  return await rapydClient.createPayment({
    amount: rideData.totalAmount,
    currency: rideData.currency,
    payment_method: rideData.paymentMethod,
    merchant_reference_id: `ride_${rideData.rideId}`,
    description: `Yah ride payment - ${rideData.rideId}`,
  });
}

// Process automatic payouts after successful payment
export async function processAutomaticPayouts(payoutData: {
  rideId: string;
  driverAmount: number;
  ceoAmount: number;
  currency: string;
  driverBeneficiaryId: string;
  ceoBeneficiaryId: string;
}) {
  // Create driver payout
  const driverPayout = await rapydClient.createPayout({
    beneficiary: payoutData.driverBeneficiaryId,
    sender_currency: payoutData.currency,
    amount: payoutData.driverAmount,
    payout_method_type: "bank_transfer",
    merchant_reference_id: `driver_payout_${payoutData.rideId}`,
    description: `Driver earnings for ride ${payoutData.rideId}`,
  });

  // Create CEO payout
  const ceoPayout = await rapydClient.createPayout({
    beneficiary: payoutData.ceoBeneficiaryId,
    sender_currency: payoutData.currency,
    amount: payoutData.ceoAmount,
    payout_method_type: "bank_transfer",
    merchant_reference_id: `ceo_payout_${payoutData.rideId}`,
    description: `Platform fee for ride ${payoutData.rideId}`,
  });

  return { driverPayout, ceoPayout };
}

// Process instant driver payout
export async function processInstantPayout(payoutData: {
  driverId: string;
  amount: number;
  currency: string;
  beneficiaryId: string;
  description?: string;
}) {
  return await rapydClient.createPayout({
    beneficiary: payoutData.beneficiaryId,
    sender_currency: payoutData.currency,
    amount: payoutData.amount,
    payout_method_type: "bank_transfer",
    merchant_reference_id: `instant_payout_${payoutData.driverId}_${Date.now()}`,
    description:
      payoutData.description ||
      `Instant payout for driver ${payoutData.driverId}`,
  });
}
