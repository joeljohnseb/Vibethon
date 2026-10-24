CREATE TYPE "public"."auth_provider" AS ENUM('email', 'google', 'phone');--> statement-breakpoint
CREATE TYPE "public"."billing_method" AS ENUM('battery_estimate', 'meter');--> statement-breakpoint
CREATE TYPE "public"."booking_mode" AS ENUM('approval', 'instant');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'rejected', 'cancelled', 'expired', 'completed');--> statement-breakpoint
CREATE TYPE "public"."cancellation_policy" AS ENUM('flexible', 'moderate', 'strict');--> statement-breakpoint
CREATE TYPE "public"."charger_status" AS ENUM('draft', 'active', 'paused', 'removed');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'investigating', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."earning_status" AS ENUM('unpaid', 'in_payout', 'paid_out');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('open', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('verify_phone', 'login');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('razorpay', 'sandbox');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'pending', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('requested', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."battery_reading_kind" AS ENUM('start', 'end');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."review_direction" AS ENUM('taker_to_giver', 'giver_to_taker');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('taker', 'giver');--> statement-breakpoint
CREATE TYPE "public"."charging_session_status" AS ENUM('awaiting_start', 'active', 'awaiting_payment', 'payment_pending', 'payment_failed', 'completed');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charger_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_blocks_range" CHECK ("availability_blocks"."start_at" < "availability_blocks"."end_at")
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charger_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "availability_weekday" CHECK ("availability_rules"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "availability_minutes" CHECK ("availability_rules"."start_minute" >= 0 AND "availability_rules"."end_minute" <= 1440 AND "availability_rules"."start_minute" < "availability_rules"."end_minute")
);
--> statement-breakpoint
CREATE TABLE "battery_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" "battery_reading_kind" NOT NULL,
	"percent" smallint NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battery_readings_percent" CHECK ("battery_readings"."percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "booking_slot_locks" (
	"charger_id" uuid NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"booking_id" uuid NOT NULL,
	CONSTRAINT "booking_slot_locks_charger_id_slot_start_pk" PRIMARY KEY("charger_id","slot_start")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"charger_id" uuid NOT NULL,
	"taker_id" uuid NOT NULL,
	"giver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"price_per_kwh_paise" integer NOT NULL,
	"platform_fee_bps" integer DEFAULT 0 NOT NULL,
	"platform_fee_fixed_paise" integer DEFAULT 0 NOT NULL,
	"tax_bps" integer DEFAULT 0 NOT NULL,
	"vehicle_battery_kwh" numeric(6, 2) NOT NULL,
	"vehicle_label" text NOT NULL,
	"connector" text NOT NULL,
	"cancellation_policy" "cancellation_policy" NOT NULL,
	"booking_mode" "booking_mode" NOT NULL,
	"taker_note" text DEFAULT '' NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text,
	"late_cancellation" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bookings_time_range" CHECK ("bookings"."start_at" < "bookings"."end_at"),
	CONSTRAINT "bookings_not_self" CHECK ("bookings"."taker_id" <> "bookings"."giver_id")
);
--> statement-breakpoint
CREATE TABLE "charger_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charger_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charger_photos_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "chargers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"address_line" text NOT NULL,
	"locality" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"connectors" text[] NOT NULL,
	"power_kw" numeric(6, 2) NOT NULL,
	"price_per_kwh_paise" integer NOT NULL,
	"parking_info" text DEFAULT '' NOT NULL,
	"access_instructions" text DEFAULT '' NOT NULL,
	"safety_info" text DEFAULT '' NOT NULL,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" charger_status DEFAULT 'draft' NOT NULL,
	"booking_mode" "booking_mode" DEFAULT 'approval' NOT NULL,
	"cancellation_policy" "cancellation_policy" DEFAULT 'flexible' NOT NULL,
	"slot_minutes" smallint DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chargers_price_positive" CHECK ("chargers"."price_per_kwh_paise" > 0 AND "chargers"."price_per_kwh_paise" <= 100000),
	CONSTRAINT "chargers_power_range" CHECK ("chargers"."power_kw" > 0 AND "chargers"."power_kw" <= 400),
	CONSTRAINT "chargers_lat_lng" CHECK ("chargers"."lat" BETWEEN -90 AND 90 AND "chargers"."lng" BETWEEN -180 AND 180),
	CONSTRAINT "chargers_slot_minutes" CHECK ("chargers"."slot_minutes" IN (30, 60))
);
--> statement-breakpoint
CREATE TABLE "charging_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"status" charging_session_status DEFAULT 'awaiting_start' NOT NULL,
	"code_verified_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charging_sessions_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "confirmation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"reporter_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giver_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"gross_paise" integer NOT NULL,
	"platform_fee_paise" integer NOT NULL,
	"net_paise" integer NOT NULL,
	"status" "earning_status" DEFAULT 'unpaid' NOT NULL,
	"payout_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earnings_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"method" "billing_method" DEFAULT 'battery_estimate' NOT NULL,
	"battery_kwh" numeric(6, 2) NOT NULL,
	"start_percent" smallint NOT NULL,
	"end_percent" smallint NOT NULL,
	"billable_wh" integer NOT NULL,
	"price_per_kwh_paise" integer NOT NULL,
	"energy_charge_paise" integer NOT NULL,
	"platform_fee_paise" integer NOT NULL,
	"tax_paise" integer NOT NULL,
	"adjustment_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"giver_earnings_paise" integer NOT NULL,
	"lines" jsonb NOT NULL,
	"status" "invoice_status" DEFAULT 'open' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "invoices_session_id_unique" UNIQUE("session_id"),
	CONSTRAINT "invoices_amounts_nonneg" CHECK ("invoices"."total_paise" >= 0 AND "invoices"."energy_charge_paise" >= 0),
	CONSTRAINT "invoices_total_consistent" CHECK ("invoices"."total_paise" = "invoices"."energy_charge_paise" + "invoices"."platform_fee_paise" + "invoices"."tax_paise" + "invoices"."adjustment_paise")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"phone" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_payment_id" text,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"method" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giver_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"provider_ref" text,
	"note" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_positive" CHECK ("payouts"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"charger_id" uuid,
	"direction" "review_direction" NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"phone" text,
	"phone_verified_at" timestamp with time zone,
	"avatar_url" text,
	"active_role" "role" DEFAULT 'taker' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"model" text NOT NULL,
	"battery_kwh" numeric(6, 2) NOT NULL,
	"connectors" text[] NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_battery_range" CHECK ("vehicles"."battery_kwh" > 0 AND "vehicles"."battery_kwh" <= 300)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_readings" ADD CONSTRAINT "battery_readings_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_readings" ADD CONSTRAINT "battery_readings_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_slot_locks" ADD CONSTRAINT "booking_slot_locks_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_slot_locks" ADD CONSTRAINT "booking_slot_locks_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_taker_id_users_id_fk" FOREIGN KEY ("taker_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_giver_id_users_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charger_photos" ADD CONSTRAINT "charger_photos_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charger_photos" ADD CONSTRAINT "charger_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargers" ADD CONSTRAINT "chargers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmation_codes" ADD CONSTRAINT "confirmation_codes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_giver_id_users_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_session_id_charging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."charging_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_giver_id_users_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_charger_id_chargers_id_fk" FOREIGN KEY ("charger_id") REFERENCES "public"."chargers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_index" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_uid" ON "auth_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "auth_identities_user_id_index" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "availability_blocks_charger_id_index" ON "availability_blocks" USING btree ("charger_id");--> statement-breakpoint
CREATE INDEX "availability_rules_charger_id_index" ON "availability_rules" USING btree ("charger_id");--> statement-breakpoint
CREATE UNIQUE INDEX "battery_readings_session_kind" ON "battery_readings" USING btree ("session_id","kind");--> statement-breakpoint
CREATE INDEX "booking_slot_locks_booking_id_index" ON "booking_slot_locks" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_taker_id_start_at_index" ON "bookings" USING btree ("taker_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_giver_id_start_at_index" ON "bookings" USING btree ("giver_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_charger_id_start_at_index" ON "bookings" USING btree ("charger_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_taker_idempotency" ON "bookings" USING btree ("taker_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "charger_photos_charger_id_index" ON "charger_photos" USING btree ("charger_id");--> statement-breakpoint
CREATE INDEX "chargers_owner_id_index" ON "chargers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "chargers_status_lat_lng_index" ON "chargers" USING btree ("status","lat","lng");--> statement-breakpoint
CREATE INDEX "confirmation_codes_booking_id_index" ON "confirmation_codes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "disputes_reporter_id_index" ON "disputes" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "disputes_status_index" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "earnings_giver_id_status_index" ON "earnings" USING btree ("giver_id","status");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_index" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_purpose_index" ON "otp_codes" USING btree ("phone","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_order" ON "payments" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_index" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_captured_per_invoice" ON "payments" USING btree ("invoice_id") WHERE "payments"."status" = 'captured';--> statement-breakpoint
CREATE INDEX "payouts_giver_id_index" ON "payouts" USING btree ("giver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_reports_one_per_reporter" ON "review_reports" USING btree ("review_id","reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_author_booking" ON "reviews" USING btree ("booking_id","author_id");--> statement-breakpoint
CREATE INDEX "reviews_subject_user_id_index" ON "reviews" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "reviews_charger_id_index" ON "reviews" USING btree ("charger_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "vehicles_user_id_index" ON "vehicles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event" ON "webhook_events" USING btree ("provider","event_id");