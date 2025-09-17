import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  decimal,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enums
export const rideStatusEnum = pgEnum("ride_status", [
  "pending",
  "searching_driver",
  "driver_assigned",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
  "completed",
  "cancelled"
]);

export const payoutFrequencyEnum = pgEnum("payout_frequency", [
  "daily",
  "weekly",
  "monthly"
]);

export const rideTypeEnum = pgEnum("ride_type", [
  "YahNow", "YahGo", "YahSwift", "YahChoice", "YahSolo", "YahGroup", "YahFamily", 
  "YahPet", "YahQuiet", "YahSilent", "YahYouth", "YahYoungGirl", "YahYoungBoy",
  "YahMan", "YahWoman", "YahSenior", "YahSingle", "YahCouple", "YahEngagement",
  "YahUnion", "YahDating", "YahMarriage", "YahWedding", "YahMatch", "YahPure",
  "YahBirthday", "YahValentine", "YahParty", "YahInvation", "YahArmy", "YahMilitary",
  "YahSecurity", "YahRoyal", "YahCelebrity", "YahElite", "YahBusiness", "YahMedical",
  "YahTravelNow", "YahTravelGo", "YahTravelSwift", "YahTravelChoice", "YahTravelYouth",
  "YahTravelYoungGirl", "YahTravelYoungBoy", "YahTravelMan", "YahTravelWoman",
  "YahTravelSenior", "YahTravelSingle", "YahTravelSolo", "YahTravelGroup",
  "YahTravelFamily", "YahTravelBusiness", "YahTravelMedical", "YahTravelEngagement",
  "YahTravelUnion", "YahTravelMarriage", "YahTravelHoneymoon", "YahTravelMatch",
  "YahTravelPure", "YahTravelArmy", "YahTravelMilitary", "YahTravelSecurity",
  "YahTravelRoyal", "YahTravelCelebrity", "YahTravelElite", "YahTravelQuiet", "YahTravelSilent"
]);

export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "credit_card",
  "debit_card", 
  "apple_pay",
  "google_pay"
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded"
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing", 
  "completed",
  "failed",
  "cancelled"
]);

export const payoutTypeEnum = pgEnum("payout_type", [
  "instant",
  "scheduled"
]);

// Customers table (matches Supabase schema)
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull(),
  pinCode: integer("pin_code"),
  fingerprintKey: text("fingerprint_key").notNull(),
  isVerified: boolean("is_verified").notNull(),
  profilePhoto: text("profile_photo"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("customer"),
  totalRides: integer("total_rides"),
  totalPayments: decimal("total_payments"),
  isActive: boolean("is_active").notNull(),
  gender: text("gender"), // 'male', 'female'
  disabledType: text("disabled_type"), // 'hearing', 'deaf', 'blind', 'disabled', 'none'
});

// OTP verification table
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone").notNull(),
  otpCode: varchar("otp_code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment methods table
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  type: paymentMethodTypeEnum("type").notNull(),
  isDefault: boolean("is_default").default(false),
  last4: varchar("last4", { length: 4 }),
  brand: varchar("brand"),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Drivers table (for customer app reference)
export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  licensePlate: text("license_plate").notNull(),
  status: text("status").notNull().default('pending'),
  currentLocation: text("current_location").notNull(),
  pinCode: bigint("pin_code", { mode: "number" }).notNull(),
  fingerprintKey: text("fingerprint_key").notNull(),
  isApproved: boolean("is_approved").notNull(),
  profilePhoto: text("profile_photo").notNull(),
  driverLicense: text("driver_license").notNull(),
  insuranceProof: text("insurance_proof").notNull(),
  isAvailable: boolean("is_available").notNull(),
  role: text("role").notNull().default('driver'),
  permissions: jsonb("permissions").notNull(),
  passwordHash: text("password_hash").notNull(),
  weeklyHours: bigint("weekly_hours", { mode: "number" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  driverId: text("driver_id").notNull(),
  userId: uuid("user_id"),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  // Rapyd beneficiary information
  rapydBeneficiaryId: text("rapyd_beneficiary_id"),
  bankAccountVerified: boolean("bank_account_verified").default(false),
  payoutMethod: text("payout_method"), // "bank_transfer" or "card"
  lastPayoutAt: timestamp("last_payout_at"),
  gender: text("gender"), // 'male', 'female'
  disabledType: text("disabled_type"), // 'hearing', 'deaf', 'blind', 'disabled', 'none'
});
// Ride categories table
export const rideCategories = pgTable("ride_categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  categoryName: text("category_name").notNull(),
  scope: text("scope").notNull(), // e.g., "In-City", "Out-of-City / Out-of-State / Travel"
  driverRatePerMile: decimal("driver_rate_per_mile", { precision: 10, scale: 2 }).notNull(),
  minRate: decimal("min_rate", { precision: 10, scale: 2 }),
  maxRate: decimal("max_rate", { precision: 10, scale: 2 }),
});

// Ride types table
export const rideTypes = pgTable("ride_types", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedByDefaultAsIdentity(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  title: text("title").notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => rideCategories.id, { onDelete: "cascade", onUpdate: "cascade" }),
  pricePerMin: decimal("price_per_min", { precision: 10, scale: 2 }),
  driverPerMile: decimal("driver_per_mile", { precision: 10, scale: 2 }).notNull(),
  name: text("name"),
  maxPassengers: bigint("max_passengers", { mode: "bigint" }).notNull(),
  requiresPet: boolean("requires_pet").notNull(),
  restrictedToGender: text("restricted_to_gender"),
  vipOnly: boolean("vip_only").notNull(),
  isFamilyFriendly: boolean("is_family_friendly").notNull(),
  active: boolean("active").notNull(),
  perPersonCharge: decimal("per_person_charge", { precision: 10, scale: 2 }).notNull(),
  perPetCharge: decimal("per_pet_charge", { precision: 10, scale: 2 }).notNull(),
  ceoRatePerMinute: decimal("ceo_rate_per_minute", { precision: 10, scale: 2 }).notNull(),
  driverRatePerMile: decimal("driver_rate_per_mile", { precision: 10, scale: 2 }).notNull(),
  customerTipMin: decimal("customer_tip_min", { precision: 10, scale: 2 }),
  customerTipMax: decimal("customer_tip_max", { precision: 10, scale: 2 }),
  taxFree: boolean("tax_free"),
  requireDoor: boolean("require_door"),
});

// Rides table - matching actual Supabase schema exactly
export const rides = pgTable("rides", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at").notNull().defaultNow(),
  customer_id: uuid("customer_id").notNull().references(() => customers.id),
  driver_id: uuid("driver_id").references(() => drivers.id),
  pickup: text("pickup").notNull(),
  dropoff: text("dropoff").notNull(),
  ride_type: text("ride_type").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, in_progress, completed, cancelled
  distance_miles: doublePrecision("distance_miles").notNull().default(0),
  duration_minutes: doublePrecision("duration_minutes").notNull().default(0),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),
  accepted_at: timestamp("accepted_at"),
  cancelled_at: timestamp("cancelled_at"),
  tip_amount: decimal("tip_amount").notNull().default("0"),
  rider_count: smallint("rider_count").notNull().default(1),
  pet_count: smallint("pet_count").notNull().default(0),
  open_door_requested: boolean("open_door_requested").notNull().default(false),
  total_fare: doublePrecision("total_fare").default(0),
  cancellation_reason: varchar("cancellation_reason"),
  person_preference_id: integer("person_preference_id").default(6).references(() => personPreferences.id, { onDelete: "cascade", onUpdate: "cascade" }),
  customer_rating: smallint("customer_rating"), // 1 = thumbs down, 2 = thumbs up
  customer_rating_emoji: text("customer_rating_emoji"),
  ride_type_id: uuid("ride_type_id").references(() => rideTypes.id, { onDelete: "set null", onUpdate: "cascade" }),
});

// YahChat sessions table
export const yahChatSessions = pgTable("yah_chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  created_at: timestamp("created_at").defaultNow(),
  customer_id: varchar("customer_id").references(() => customers.id),
  driver_id: varchar("driver_id").references(() => drivers.id),
  ride_id: varchar("ride_id").references(() => rides.id),
  session_id: text("session_id"),
  room_name: text("room_name"),
  status: text("status").default("active"),
  is_active: boolean("is_active").default(true),
  started_at: timestamp("started_at").defaultNow(),
});

// Payments table - enhanced with Rapyd integration
export const payments = pgTable("payments", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  ride_id: uuid("ride_id").notNull().references(() => rides.id, { onDelete: "cascade", onUpdate: "cascade" }),
  customer_id: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  amount: decimal("amount").notNull(),
  payment_method: text("payment_method").notNull(),
  reference_id: text("reference_id").notNull(),
  status: paymentStatusEnum("status").notNull(),
  notes: text("notes").notNull(),
  // Rapyd integration fields
  rapyd_payment_id: text("rapyd_payment_id"),
  driver_amount: decimal("driver_amount"), // Amount going to driver
  ceo_amount: decimal("ceo_amount"), // Amount going to CEO/company
  split_completed: boolean("split_completed").default(false),
  currency: text("currency").default("USD")
});

// Rapyd beneficiaries table
export const rapydBeneficiaries = pgTable("rapyd_beneficiaries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at").notNull().defaultNow(),
  driver_id: uuid("driver_id").references(() => drivers.id, { onDelete: "cascade" }),
  customer_id: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  beneficiary_id: text("beneficiary_id").notNull().unique(), // Rapyd beneficiary ID
  beneficiary_type: text("beneficiary_type").notNull(), // "driver" or "ceo"
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  payment_method: text("payment_method").notNull(), // "bank_transfer", "card", etc.
  is_verified: boolean("is_verified").default(false),
  account_details: jsonb("account_details"), // Encrypted bank/card details
});

// Driver payouts table
export const driverPayouts = pgTable("driver_payouts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at").notNull().defaultNow(),
  driver_id: uuid("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  amount: decimal("amount").notNull(),
  currency: text("currency").default("USD"),
  payout_type: payoutTypeEnum("payout_type").notNull(),
  status: payoutStatusEnum("status").notNull().default("pending"),
  rapyd_payout_id: text("rapyd_payout_id"),
  beneficiary_id: text("beneficiary_id").notNull(),
  requested_at: timestamp("requested_at"),
  processed_at: timestamp("processed_at"),
  completed_at: timestamp("completed_at"),
  failed_reason: text("failed_reason"),
  period_start: timestamp("period_start"), // For scheduled payouts
  period_end: timestamp("period_end"), // For scheduled payouts
});

// Payment splits table - track how payments are divided
export const paymentSplits = pgTable("payment_splits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at").notNull().defaultNow(),
  payment_id: bigint("payment_id", { mode: "number" }).notNull().references(() => payments.id, { onDelete: "cascade" }),
  ride_id: uuid("ride_id").notNull().references(() => rides.id, { onDelete: "cascade" }),
  driver_id: uuid("driver_id").notNull(),
  total_amount: decimal("total_amount").notNull(),
  driver_amount: decimal("driver_amount").notNull(),
  ceo_amount: decimal("ceo_amount").notNull(),
  driver_beneficiary_id: text("driver_beneficiary_id").notNull(),
  ceo_beneficiary_id: text("ceo_beneficiary_id").notNull(),
  split_status: text("split_status").default("pending"), // pending, completed, failed
  rapyd_payment_id: text("rapyd_payment_id")
});

// Ride requests table (driver bidding system)
export const rideRequests = pgTable("ride_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  customer_id: uuid("customer_id").notNull().default(sql`gen_random_uuid()`),
  driver_id: uuid("driver_id").notNull().default(sql`gen_random_uuid()`),
  ride_id: uuid("ride_id").notNull().default(sql`gen_random_uuid()`),
  addons: jsonb("addons"),
  status: text("status").default('requested'),
  pickup: text("pickup"),
  dropoff: text("dropoff"),
  ride_count: smallint("ride_count"),
  pet_count: smallint("pet_count"),
  estimated_distance: decimal("estimated_distance"),
  estimated_duration: decimal("estimated_duration"),
  estimated_fare_min: decimal("estimated_fare_min"),
  estimated_fare_max: decimal("estimated_fare_max"),
  notes: text("notes"),
  driver_assigned_at: timestamp("driver_assigned_at"),
  accepted_at: timestamp("accepted_at"),
  cancelled_at: timestamp("cancelled_at"),
  expired_at: timestamp("expired_at"),
});

// Yah messages table (for chat functionality) - matches Supabase schema
export const yahMessages = pgTable("yah_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  ride_id: uuid("ride_id").notNull().references(() => rides.id, { onUpdate: "cascade", onDelete: "cascade" }),
  sender_by: uuid("sender_by").notNull(),
  sender_role: text("sender_role").notNull(),
  message: text("message").notNull(),
  is_deleted: boolean("is_deleted").notNull().default(false),
  chat_session_id: uuid("chat_session_id").notNull().references(() => yahChatSessions.id, { onUpdate: "cascade", onDelete: "cascade" }),
  is_read: boolean("is_read").default(false),
});

// Driver reports table
export const driverReports = pgTable("driver_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  rideId: varchar("ride_id").notNull().references(() => rides.id),
  reportReason: text("report_reason").notNull(),
  description: text("description"),
  status: varchar("status").default("pending"), // pending, reviewed, resolved
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved locations table
export const savedLocations = pgTable("saved_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(), // "Home", "Work", etc.
  address: text("address").notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Person preferences table for driver rider group preferences
export const personPreferences = pgTable("person_preferences", {
  id: bigint("id", { mode: "bigint" }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  name: varchar("name").notNull(), // 'deaf', 'hearing', 'disabled', 'general'
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

// Insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({
  createdAt: true,
}).extend({
  id: z.string().optional(), // Allow optional ID for Supabase user ID
});

export const insertRideSchema = createInsertSchema(rides).omit({
  id: true,
  created_at: true,
}).extend({
  // Add validation for passenger and pet counts
  rider_count: z.number().min(1).max(20).optional(),
  pet_count: z.number().min(0).max(10).optional(),
  
  // Make some fields optional since they can be null in database
  driver_id: z.string().optional(),
  accepted_at: z.date().optional().nullable(),
  cancelled_at: z.date().optional().nullable(),
  tip_amount: z.string().optional().nullable(),
  open_door_requested: z.boolean().optional().nullable(),
  person_preference_id: z.number().min(1).max(6).optional(),
  ride_type_id: z.string().optional(),
  total_fare: z.number().optional().nullable(),
});

export const insertOtpSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedLocationSchema = createInsertSchema(savedLocations).omit({
  id: true,
  createdAt: true,
});

export const insertYahMessageSchema = createInsertSchema(yahMessages).omit({
  id: true,
  created_at: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  created_at: true,
});

export const insertDriverReportSchema = createInsertSchema(driverReports).omit({
  id: true,
  createdAt: true,
});

export const insertRideTypeSchema = createInsertSchema(rideTypes).omit({
  id: true,
  createdAt: true,
});

export const insertRideRequestSchema = createInsertSchema(rideRequests).omit({
  id: true,
  created_at: true,
});

export const insertYahChatSessionSchema = createInsertSchema(yahChatSessions).omit({
  id: true,
  created_at: true,
});

export const insertRapydBeneficiarySchema = createInsertSchema(rapydBeneficiaries).omit({
  id: true,
  created_at: true,
});

export const insertDriverPayoutSchema = createInsertSchema(driverPayouts).omit({
  id: true,
  created_at: true,
});

export const insertPaymentSplitSchema = createInsertSchema(paymentSplits).omit({
  id: true,
  created_at: true,
});

// Types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtp = z.infer<typeof insertOtpSchema>;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

export type Driver = typeof drivers.$inferSelect;

export type RideType = typeof rideTypes.$inferSelect;
export type InsertRideType = z.infer<typeof insertRideTypeSchema>;

export type Ride = typeof rides.$inferSelect;
export type InsertRide = z.infer<typeof insertRideSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type ChatMessage = typeof yahMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertYahMessageSchema>;

export type DriverReport = typeof driverReports.$inferSelect;
export type InsertDriverReport = z.infer<typeof insertDriverReportSchema>;

export type SavedLocation = typeof savedLocations.$inferSelect;
export type InsertSavedLocation = z.infer<typeof insertSavedLocationSchema>;

export type RideRequest = typeof rideRequests.$inferSelect;
export type InsertRideRequest = z.infer<typeof insertRideRequestSchema>;

export type YahChatSession = typeof yahChatSessions.$inferSelect;
export type InsertYahChatSession = z.infer<typeof insertYahChatSessionSchema>;

// Additional payment tables for Adyen integration
export const adyenPayments = pgTable("adyen_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  pspReference: varchar("psp_reference").notNull().unique(),
  amount: integer("amount").notNull(), // Amount in minor units (cents)
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  reference: varchar("reference").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  paymentMethod: varchar("payment_method").notNull(),
  shopperReference: varchar("shopper_reference"),
  metadata: jsonb("metadata"),
  capturedAt: timestamp("captured_at"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adyenPayouts = pgTable("adyen_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  pspReference: varchar("psp_reference").notNull().unique(),
  amount: integer("amount").notNull(), // Amount in minor units (cents)
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  reference: varchar("reference").notNull(),
  status: payoutStatusEnum("status").notNull().default("pending"),
  destinationType: varchar("destination_type").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("event_type").notNull(),
  pspReference: varchar("psp_reference").notNull(),
  merchantAccount: varchar("merchant_account").notNull(),
  eventData: jsonb("event_data").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ceoPayouts = pgTable("ceo_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ceoId: uuid("ceo_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  bankAccount: jsonb("bank_account").notNull(),
  status: payoutStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas for new tables
export const insertAdyenPaymentSchema = createInsertSchema(adyenPayments);
export const insertAdyenPayoutSchema = createInsertSchema(adyenPayouts);
export const insertWebhookEventSchema = createInsertSchema(webhookEvents);
export const insertCEOPayoutSchema = createInsertSchema(ceoPayouts);

export type RapydBeneficiary = typeof rapydBeneficiaries.$inferSelect;
export type InsertRapydBeneficiary = z.infer<typeof insertRapydBeneficiarySchema>;

export type DriverPayout = typeof driverPayouts.$inferSelect;
export type InsertDriverPayout = z.infer<typeof insertDriverPayoutSchema>;

export type PaymentSplit = typeof paymentSplits.$inferSelect;
export type InsertPaymentSplit = z.infer<typeof insertPaymentSplitSchema>;

// Adyen payment types
export type AdyenPayment = typeof adyenPayments.$inferSelect;
export type InsertAdyenPayment = z.infer<typeof insertAdyenPaymentSchema>;

export type AdyenPayout = typeof adyenPayouts.$inferSelect;
export type InsertAdyenPayout = z.infer<typeof insertAdyenPayoutSchema>;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;

export type CEOPayout = typeof ceoPayouts.$inferSelect;
export type InsertCEOPayout = z.infer<typeof insertCEOPayoutSchema>;

// Multi-vehicle booking helper types
export interface MultiVehicleBooking {
  bookingId: string;
  customerId: string;
  totalPassengers: number;
  totalVehicles: number;
  totalFare: number;
  rides: Ride[];
}

// Fare calculation breakdown type
export interface FareBreakdown {
  baseFare: number;
  distanceFee: number;
  timeFee: number;
  passengerFee: number;
  petFee: number;
  multiVehicleTip: number;
  total: number;
  vehicleCount: number;
}
