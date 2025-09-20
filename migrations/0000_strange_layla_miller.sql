CREATE TYPE "public"."payment_method_type" AS ENUM('credit_card', 'debit_card', 'apple_pay', 'google_pay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payout_type" AS ENUM('instant', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('pending', 'searching_driver', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ride_type" AS ENUM('YahNow', 'YahGo', 'YahSwift', 'YahChoice', 'YahSolo', 'YahGroup', 'YahFamily', 'YahPet', 'YahQuiet', 'YahSilent', 'YahYouth', 'YahYoungGirl', 'YahYoungBoy', 'YahMan', 'YahWoman', 'YahSenior', 'YahSingle', 'YahCouple', 'YahEngagement', 'YahUnion', 'YahDating', 'YahMarriage', 'YahWedding', 'YahMatch', 'YahPure', 'YahBirthday', 'YahValentine', 'YahParty', 'YahInvation', 'YahArmy', 'YahMilitary', 'YahSecurity', 'YahRoyal', 'YahCelebrity', 'YahElite', 'YahBusiness', 'YahMedical', 'YahTravelNow', 'YahTravelGo', 'YahTravelSwift', 'YahTravelChoice', 'YahTravelYouth', 'YahTravelYoungGirl', 'YahTravelYoungBoy', 'YahTravelMan', 'YahTravelWoman', 'YahTravelSenior', 'YahTravelSingle', 'YahTravelSolo', 'YahTravelGroup', 'YahTravelFamily', 'YahTravelBusiness', 'YahTravelMedical', 'YahTravelEngagement', 'YahTravelUnion', 'YahTravelMarriage', 'YahTravelHoneymoon', 'YahTravelMatch', 'YahTravelPure', 'YahTravelArmy', 'YahTravelMilitary', 'YahTravelSecurity', 'YahTravelRoyal', 'YahTravelCelebrity', 'YahTravelElite', 'YahTravelQuiet', 'YahTravelSilent');--> statement-breakpoint
CREATE TABLE "adyen_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"psp_reference" varchar NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"reference" varchar NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" varchar NOT NULL,
	"shopper_reference" varchar,
	"metadata" jsonb,
	"captured_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "adyen_payments_psp_reference_unique" UNIQUE("psp_reference")
);
--> statement-breakpoint
CREATE TABLE "adyen_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"psp_reference" varchar NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"reference" varchar NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"destination_type" varchar NOT NULL,
	"description" text,
	"metadata" jsonb,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "adyen_payouts_psp_reference_unique" UNIQUE("psp_reference")
);
--> statement-breakpoint
CREATE TABLE "ceo_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ceo_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"bank_account" jsonb NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"status" text NOT NULL,
	"pin_code" integer,
	"fingerprint_key" text NOT NULL,
	"is_verified" boolean NOT NULL,
	"profile_photo" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"total_rides" integer,
	"total_payments" numeric,
	"is_active" boolean NOT NULL,
	"gender" text,
	"disabled_type" text
);
--> statement-breakpoint
CREATE TABLE "driver_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD',
	"payout_type" "payout_type" NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"rapyd_payout_id" text,
	"beneficiary_id" text NOT NULL,
	"requested_at" timestamp,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"failed_reason" text,
	"period_start" timestamp,
	"period_end" timestamp
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"license_plate" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_location" text NOT NULL,
	"pin_code" bigint NOT NULL,
	"fingerprint_key" text NOT NULL,
	"is_approved" boolean NOT NULL,
	"profile_photo" text NOT NULL,
	"driver_license" text NOT NULL,
	"insurance_proof" text NOT NULL,
	"is_available" boolean NOT NULL,
	"role" text DEFAULT 'driver' NOT NULL,
	"permissions" jsonb NOT NULL,
	"password_hash" text NOT NULL,
	"weekly_hours" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"driver_id" text NOT NULL,
	"user_id" uuid,
	"current_lat" double precision,
	"current_lng" double precision,
	"rapyd_beneficiary_id" text,
	"bank_account_verified" boolean DEFAULT false,
	"payout_method" text,
	"last_payout_at" timestamp,
	"gender" text,
	"disabled_type" text
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar NOT NULL,
	"otp_code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"type" "payment_method_type" NOT NULL,
	"is_default" boolean DEFAULT false,
	"last4" varchar(4),
	"brand" varchar,
	"expiry_month" integer,
	"expiry_year" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"payment_id" bigint NOT NULL,
	"ride_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"total_amount" numeric NOT NULL,
	"driver_amount" numeric NOT NULL,
	"ceo_amount" numeric NOT NULL,
	"driver_beneficiary_id" text NOT NULL,
	"ceo_beneficiary_id" text NOT NULL,
	"split_status" text DEFAULT 'pending',
	"rapyd_payment_id" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ride_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"payment_method" text NOT NULL,
	"reference_id" text NOT NULL,
	"status" "payment_status" NOT NULL,
	"notes" text NOT NULL,
	"rapyd_payment_id" text,
	"driver_amount" numeric,
	"ceo_amount" numeric,
	"split_completed" boolean DEFAULT false,
	"currency" text DEFAULT 'USD'
);
--> statement-breakpoint
CREATE TABLE "person_preferences" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rapyd_beneficiaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"driver_id" uuid,
	"customer_id" uuid,
	"beneficiary_id" text NOT NULL,
	"beneficiary_type" text NOT NULL,
	"country" text NOT NULL,
	"currency" text NOT NULL,
	"payment_method" text NOT NULL,
	"is_verified" boolean DEFAULT false,
	"account_details" jsonb,
	CONSTRAINT "rapyd_beneficiaries_beneficiary_id_unique" UNIQUE("beneficiary_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"ride_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"reported_by" text NOT NULL,
	"violation_type_id" bigint,
	"custom_reason" text,
	"description" text,
	"media_files" jsonb,
	"has_media" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"action_taken" text,
	"admin_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ride_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_name" varchar NOT NULL,
	"scope" varchar NOT NULL,
	"driver_rate_per_mile" numeric(10, 2),
	"min_tip" numeric(10, 2),
	"max_tip" numeric(10, 2),
	"per_person_fee" numeric(10, 2),
	"per_pet_fee" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "ride_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ride_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"addons" jsonb,
	"status" text DEFAULT 'requested',
	"pickup" text,
	"dropoff" text,
	"ride_count" smallint,
	"pet_count" smallint,
	"estimated_distance" numeric,
	"estimated_duration" numeric,
	"estimated_fare_min" numeric,
	"estimated_fare_max" numeric,
	"notes" text,
	"driver_assigned_at" timestamp,
	"accepted_at" timestamp,
	"cancelled_at" timestamp,
	"expired_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ride_types" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "ride_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"price_per_min" numeric(10, 2),
	"driver_per_mile" numeric(10, 2) NOT NULL,
	"name" text,
	"max_passengers" bigint NOT NULL,
	"requires_pet" boolean NOT NULL,
	"restricted_to_gender" text,
	"vip_only" boolean NOT NULL,
	"is_family_friendly" boolean NOT NULL,
	"active" boolean NOT NULL,
	"per_person_charge" numeric(10, 2) NOT NULL,
	"per_pet_charge" numeric(10, 2) NOT NULL,
	"ceo_rate_per_minute" numeric(10, 2) NOT NULL,
	"driver_rate_per_mile" numeric(10, 2) NOT NULL,
	"customer_tip_min" numeric(10, 2),
	"customer_tip_max" numeric(10, 2),
	"tax_free" boolean,
	"require_door" boolean
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"customer_id" uuid NOT NULL,
	"driver_id" uuid,
	"pickup" text NOT NULL,
	"dropoff" text NOT NULL,
	"ride_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"distance_miles" double precision DEFAULT 0 NOT NULL,
	"duration_minutes" double precision DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"accepted_at" timestamp,
	"cancelled_at" timestamp,
	"tip_amount" numeric DEFAULT '0' NOT NULL,
	"rider_count" smallint DEFAULT 1 NOT NULL,
	"pet_count" smallint DEFAULT 0 NOT NULL,
	"open_door_requested" boolean DEFAULT false NOT NULL,
	"total_fare" double precision DEFAULT 0,
	"cancellation_reason" varchar,
	"person_preference_id" integer DEFAULT 6,
	"customer_rating" smallint,
	"customer_rating_emoji" text,
	"ride_type_id" uuid,
	"ride_scope" varchar DEFAULT 'In-City' NOT NULL,
	"created_via_qr" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"address" text NOT NULL,
	"lat" numeric(10, 8) NOT NULL,
	"lng" numeric(11, 8) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "violation_types" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text NOT NULL,
	"action" text NOT NULL,
	"severity" text NOT NULL,
	"requires_immediate_action" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "violation_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar NOT NULL,
	"psp_reference" varchar NOT NULL,
	"merchant_account" varchar NOT NULL,
	"event_data" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yah_chat_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"customer_id" varchar,
	"driver_id" varchar,
	"ride_id" varchar,
	"session_id" text,
	"room_name" text,
	"status" text DEFAULT 'active',
	"is_active" boolean DEFAULT true,
	"started_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "yah_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ride_id" uuid NOT NULL,
	"sender_by" uuid NOT NULL,
	"sender_role" text NOT NULL,
	"message" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"chat_session_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "driver_payouts" ADD CONSTRAINT "driver_payouts_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_splits" ADD CONSTRAINT "payment_splits_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_splits" ADD CONSTRAINT "payment_splits_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapyd_beneficiaries" ADD CONSTRAINT "rapyd_beneficiaries_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapyd_beneficiaries" ADD CONSTRAINT "rapyd_beneficiaries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_violation_type_id_violation_types_id_fk" FOREIGN KEY ("violation_type_id") REFERENCES "public"."violation_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_types" ADD CONSTRAINT "ride_types_category_id_ride_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ride_categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_person_preference_id_person_preferences_id_fk" FOREIGN KEY ("person_preference_id") REFERENCES "public"."person_preferences"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_ride_type_id_ride_types_id_fk" FOREIGN KEY ("ride_type_id") REFERENCES "public"."ride_types"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yah_chat_sessions" ADD CONSTRAINT "yah_chat_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yah_chat_sessions" ADD CONSTRAINT "yah_chat_sessions_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yah_chat_sessions" ADD CONSTRAINT "yah_chat_sessions_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yah_messages" ADD CONSTRAINT "yah_messages_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "yah_messages" ADD CONSTRAINT "yah_messages_chat_session_id_yah_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."yah_chat_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");