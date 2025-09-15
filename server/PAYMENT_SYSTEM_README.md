# Yah Customer PWA - Payment System Documentation

## Overview

This document describes the comprehensive payment system built using Adyen for the Yah Customer PWA. The system handles payment processing, instant payouts, automatic periodic payouts, and webhook processing.

## Architecture

### Core Components

1. **PaymentService** (`server/paymentService.ts`) - Main payment processing service
2. **PaymentRoutes** (`server/paymentRoutes.ts`) - API endpoints for payment operations
3. **ScheduledPayoutService** (`server/scheduledPayoutService.ts`) - Automated payout scheduling
4. **Database Schema** (`shared/schema.ts`) - Payment-related database tables

### Database Tables

- `adyen_payments` - Stores payment transactions
- `adyen_payouts` - Stores payout transactions
- `webhook_events` - Stores webhook events from Adyen
- `ceo_payouts` - Stores CEO payout information
- `drivers` - Updated with payout frequency and bank account info

## API Endpoints

### Payment Operations

#### Create Payment
```
POST /api/payments/create
```

**Request Body:**
```json
{
  "amount": {
    "currency": "USD",
    "value": 1000
  },
  "reference": "order-123",
  "paymentMethod": {
    "type": "scheme",
    "encryptedCardNumber": "test_4111111111111111",
    "encryptedExpiryMonth": "test_03",
    "encryptedExpiryYear": "test_2030",
    "encryptedSecurityCode": "test_737"
  },
  "shopperReference": "customer-123",
  "storePaymentMethod": true,
  "shopperInteraction": "Ecommerce",
  "recurringProcessingModel": "CardOnFile",
  "returnUrl": "https://your-company.com/return",
  "merchantAccount": "YOUR_MERCHANT_ACCOUNT"
}
```

#### Capture Payment
```
POST /api/payments/capture
```

**Request Body:**
```json
{
  "pspReference": "payment-reference",
  "amount": {
    "currency": "USD",
    "value": 1000
  }
}
```

#### Refund Payment
```
POST /api/payments/refund
```

**Request Body:**
```json
{
  "pspReference": "payment-reference",
  "amount": {
    "currency": "USD",
    "value": 1000
  }
}
```

### Payout Operations

#### Create Instant Payout
```
POST /api/payments/payout
```

**Request Body:**
```json
{
  "amount": {
    "currency": "USD",
    "value": 5000
  },
  "reference": "payout-123",
  "destination": {
    "type": "bankAccount",
    "bankAccount": {
      "accountNumber": "1234567890",
      "bankCode": "123456",
      "countryCode": "US",
      "ownerName": "John Doe"
    }
  },
  "description": "Driver payout",
  "merchantAccount": "YOUR_MERCHANT_ACCOUNT"
}
```

#### Process Periodic Payouts
```
POST /api/payments/periodic-payouts
```

**Request Body:**
```json
{
  "payouts": [
    {
      "recipientId": "driver-123",
      "recipientType": "driver",
      "amount": {
        "currency": "USD",
        "value": 5000
      },
      "bankAccount": {
        "accountNumber": "1234567890",
        "bankCode": "123456",
        "countryCode": "US",
        "ownerName": "John Doe"
      },
      "description": "Weekly driver payout"
    }
  ]
}
```

### Status and History

#### Get Payment Status
```
GET /api/payments/status/:pspReference
```

#### Get Payout Status
```
GET /api/payments/payout-status/:pspReference
```

#### Get Customer Payments
```
GET /api/payments/customer/:customerId?limit=50&offset=0
```

#### Get Recipient Payouts
```
GET /api/payments/recipient/:recipientId?limit=50&offset=0
```

### Webhook Endpoint

#### Adyen Webhook
```
POST /api/payments/webhook
```

This endpoint receives webhook notifications from Adyen for various payment events.

## Scheduled Payouts

The system automatically processes payouts based on configured schedules:

### Daily Payouts
- **Schedule**: Every day at 2:00 AM
- **Target**: Drivers with `payout_frequency = 'daily'`
- **Process**: Pays out all pending earnings

### Weekly Payouts
- **Schedule**: Every Sunday at 3:00 AM
- **Target**: Drivers with `payout_frequency = 'weekly'`
- **Process**: Pays out all pending earnings

### Monthly Payouts
- **Schedule**: 1st of every month at 4:00 AM
- **Target**: 
  - Drivers with `payout_frequency = 'monthly'`
  - CEO payouts from `ceo_payouts` table
- **Process**: Pays out all pending earnings and CEO amounts

## Webhook Events

The system handles the following Adyen webhook events:

- `AUTHORISATION` - Payment authorization events
- `CAPTURE` - Payment capture events
- `REFUND` - Payment refund events
- `PAYOUT` - Payout events
- `TRANSFER` - Transfer events

## Configuration

### Environment Variables

The payment system uses the following configuration from `server/config.ts`:

```typescript
export const config = {
  payments: {
    adyen: {
      apiKey: "YOUR_ADYEN_API_KEY",
      merchantAccount: "YOUR_MERCHANT_ACCOUNT",
      environment: "TEST" // or "LIVE"
    }
  }
};
```

### Database Setup

Run the following SQL to create the required tables:

```sql
-- Create payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending', 'authorised', 'captured', 'refunded', 'failed', 'cancelled'
);

-- Create payout status enum
CREATE TYPE payout_status AS ENUM (
  'pending', 'received', 'failed', 'cancelled'
);

-- Create payout frequency enum
CREATE TYPE payout_frequency AS ENUM (
  'daily', 'weekly', 'monthly'
);

-- Create Adyen payments table
CREATE TABLE adyen_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psp_reference VARCHAR NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  reference VARCHAR NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method VARCHAR NOT NULL,
  shopper_reference VARCHAR,
  metadata JSONB,
  captured_at TIMESTAMP,
  refunded_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Adyen payouts table
CREATE TABLE adyen_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psp_reference VARCHAR NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  reference VARCHAR NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  destination_type VARCHAR NOT NULL,
  description TEXT,
  metadata JSONB,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create webhook events table
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR NOT NULL,
  psp_reference VARCHAR NOT NULL,
  merchant_account VARCHAR NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create CEO payouts table
CREATE TABLE ceo_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceo_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  bank_account JSONB NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  description TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Update drivers table
ALTER TABLE drivers ADD COLUMN payout_frequency payout_frequency NOT NULL DEFAULT 'weekly';
ALTER TABLE drivers ADD COLUMN bank_account JSONB;
ALTER TABLE drivers ADD COLUMN pending_earnings DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE drivers ADD COLUMN last_payout_date TIMESTAMP;
```

## Usage Examples

### Creating a Payment

```typescript
import { paymentService } from './server/paymentService';

const paymentData = {
  amount: { currency: "USD", value: 1000 },
  reference: "ride-123",
  paymentMethod: {
    type: "scheme",
    encryptedCardNumber: "test_4111111111111111",
    encryptedExpiryMonth: "test_03",
    encryptedExpiryYear: "test_2030",
    encryptedSecurityCode: "test_737"
  },
  shopperReference: "customer-123",
  storePaymentMethod: true,
  shopperInteraction: "Ecommerce",
  recurringProcessingModel: "CardOnFile",
  merchantAccount: "YOUR_MERCHANT_ACCOUNT"
};

const result = await paymentService.createPayment(paymentData);
```

### Creating an Instant Payout

```typescript
const payoutData = {
  amount: { currency: "USD", value: 5000 },
  reference: "driver-payout-123",
  destination: {
    type: "bankAccount",
    bankAccount: {
      accountNumber: "1234567890",
      bankCode: "123456",
      countryCode: "US",
      ownerName: "John Doe"
    }
  },
  description: "Driver earnings payout",
  merchantAccount: "YOUR_MERCHANT_ACCOUNT"
};

const result = await paymentService.createInstantPayout(payoutData);
```

### Processing Webhooks

```typescript
// Webhook handler automatically processes events
app.post('/api/payments/webhook', async (req, res) => {
  const result = await paymentService.processWebhook(req.body);
  res.json(result);
});
```

## Security Considerations

1. **API Keys**: Store Adyen API keys securely in environment variables
2. **Webhook Verification**: Implement webhook signature verification
3. **Data Encryption**: Sensitive payment data should be encrypted
4. **Access Control**: Implement proper authentication and authorization
5. **Rate Limiting**: Implement rate limiting for API endpoints

## Monitoring and Logging

The system includes comprehensive logging for:
- Payment creation and processing
- Payout processing
- Webhook events
- Error handling
- Database operations

## Error Handling

The system handles various error scenarios:
- Payment failures
- Payout failures
- Network timeouts
- Invalid data
- Database errors

## Testing

Use Adyen's test environment and test card numbers for development:
- Test Card: 4111 1111 1111 1111
- Expiry: Any future date
- CVC: Any 3-digit number

## Support

For issues or questions regarding the payment system:
1. Check the logs for error messages
2. Verify Adyen configuration
3. Check database connectivity
4. Review webhook endpoint configuration

## Future Enhancements

Potential improvements:
1. Payment method tokenization
2. Recurring payments
3. Multi-currency support
4. Advanced fraud detection
5. Payment analytics dashboard
6. Mobile payment integration
