import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ----------------------------------------------------------------------------
 * Enums
 * --------------------------------------------------------------------------*/
export const roleEnum = pgEnum("role", ["taker", "giver"]);
export const authProviderEnum = pgEnum("auth_provider", ["email", "google", "phone"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["verify_phone", "login"]);
export const chargerStatusEnum = pgEnum("charger_status", ["draft", "active", "paused", "removed"]);
export const bookingModeEnum = pgEnum("booking_mode", ["approval", "instant"]);
export const cancellationPolicyEnum = pgEnum("cancellation_policy", ["flexible", "moderate", "strict"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "expired",
  "completed",
]);
export const sessionStatusEnum = pgEnum("charging_session_status", [
  "awaiting_start",
  "active",
  "awaiting_payment",
  "payment_pending",
  "payment_failed",
  "completed",
]);
export const readingKindEnum = pgEnum("battery_reading_kind", ["start", "end"]);
export const billingMethodEnum = pgEnum("billing_method", ["battery_estimate", "meter"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["open", "paid", "void"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["razorpay", "sandbox"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);
export const earningStatusEnum = pgEnum("earning_status", ["unpaid", "in_payout", "paid_out"]);
export const payoutStatusEnum = pgEnum("payout_status", ["requested", "processing", "paid", "failed"]);
export const reviewDirectionEnum = pgEnum("review_direction", ["taker_to_giver", "giver_to_taker"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "actioned", "dismissed"]);
export const disputeStatusEnum = pgEnum("dispute_status", ["open", "investigating", "resolved", "dismissed"]);

/* ----------------------------------------------------------------------------
 * Users & auth
 * --------------------------------------------------------------------------*/
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    emailVerifiedAt: ts("email_verified_at"),
    passwordHash: text("password_hash"),
    phone: text("phone"),
    phoneVerifiedAt: ts("phone_verified_at"),
    avatarUrl: text("avatar_url"),
    activeRole: roleEnum("active_role").notNull().default("taker"),
    isAdmin: boolean("is_admin").notNull().default(false),
    suspendedAt: ts("suspended_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    uniqueIndex("users_phone_unique").on(t.phone),
  ],
);

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_identities_provider_uid").on(t.provider, t.providerUserId), index().on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the opaque cookie token; the raw token never touches the DB.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.phone, t.purpose)],
);

/* ----------------------------------------------------------------------------
 * Vehicles
 * --------------------------------------------------------------------------*/
export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    model: text("model").notNull(),
    batteryKwh: numeric("battery_kwh", { precision: 6, scale: 2, mode: "number" }).notNull(),
    connectors: text("connectors").array().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.userId),
    check("vehicles_battery_range", sql`${t.batteryKwh} > 0 AND ${t.batteryKwh} <= 300`),
  ],
);

/* ----------------------------------------------------------------------------
 * Chargers
 * --------------------------------------------------------------------------*/
export const chargers = pgTable(
  "chargers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // Private — only revealed to a charge taker after their booking is confirmed.
    addressLine: text("address_line").notNull(),
    locality: text("locality").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    connectors: text("connectors").array().notNull(),
    powerKw: numeric("power_kw", { precision: 6, scale: 2, mode: "number" }).notNull(),
    pricePerKwhPaise: integer("price_per_kwh_paise").notNull(),
    parkingInfo: text("parking_info").notNull().default(""),
    accessInstructions: text("access_instructions").notNull().default(""),
    safetyInfo: text("safety_info").notNull().default(""),
    amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
    status: chargerStatusEnum("status").notNull().default("draft"),
    bookingMode: bookingModeEnum("booking_mode").notNull().default("approval"),
    cancellationPolicy: cancellationPolicyEnum("cancellation_policy").notNull().default("flexible"),
    slotMinutes: smallint("slot_minutes").notNull().default(60),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.ownerId),
    index().on(t.status, t.lat, t.lng),
    check("chargers_price_positive", sql`${t.pricePerKwhPaise} > 0 AND ${t.pricePerKwhPaise} <= 100000`),
    check("chargers_power_range", sql`${t.powerKw} > 0 AND ${t.powerKw} <= 400`),
    check("chargers_lat_lng", sql`${t.lat} BETWEEN -90 AND 90 AND ${t.lng} BETWEEN -180 AND 180`),
    check("chargers_slot_minutes", sql`${t.slotMinutes} IN (30, 60)`),
  ],
);

export const chargerPhotos = pgTable(
  "charger_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargerId: uuid("charger_id").references(() => chargers.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.chargerId)],
);

/** Weekly recurring availability window, in the charger's local timezone. */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargerId: uuid("charger_id")
      .notNull()
      .references(() => chargers.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = Sunday
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
  },
  (t) => [
    index().on(t.chargerId),
    check("availability_weekday", sql`${t.weekday} BETWEEN 0 AND 6`),
    check(
      "availability_minutes",
      sql`${t.startMinute} >= 0 AND ${t.endMinute} <= 1440 AND ${t.startMinute} < ${t.endMinute}`,
    ),
  ],
);

/** One-off blocked period (holiday, maintenance) set by the homeowner. */
export const availabilityBlocks = pgTable(
  "availability_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargerId: uuid("charger_id")
      .notNull()
      .references(() => chargers.id, { onDelete: "cascade" }),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.chargerId), check("availability_blocks_range", sql`${t.startAt} < ${t.endAt}`)],
);

/* ----------------------------------------------------------------------------
 * Bookings
 * --------------------------------------------------------------------------*/
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    chargerId: uuid("charger_id")
      .notNull()
      .references(() => chargers.id, { onDelete: "restrict" }),
    takerId: uuid("taker_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    giverId: uuid("giver_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    status: bookingStatusEnum("status").notNull().default("pending"),
    // Pricing snapshot captured at booking time — later listing edits never change these terms.
    pricePerKwhPaise: integer("price_per_kwh_paise").notNull(),
    platformFeeBps: integer("platform_fee_bps").notNull().default(0),
    platformFeeFixedPaise: integer("platform_fee_fixed_paise").notNull().default(0),
    taxBps: integer("tax_bps").notNull().default(0),
    vehicleBatteryKwh: numeric("vehicle_battery_kwh", { precision: 6, scale: 2, mode: "number" }).notNull(),
    vehicleLabel: text("vehicle_label").notNull(),
    connector: text("connector").notNull(),
    cancellationPolicy: cancellationPolicyEnum("cancellation_policy").notNull(),
    bookingMode: bookingModeEnum("booking_mode").notNull(),
    takerNote: text("taker_note").notNull().default(""),
    decisionNote: text("decision_note"),
    decidedAt: ts("decided_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
    lateCancellation: boolean("late_cancellation").notNull().default(false),
    idempotencyKey: text("idempotency_key"),
    reminderSentAt: ts("reminder_sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.takerId, t.startAt),
    index().on(t.giverId, t.startAt),
    index().on(t.chargerId, t.startAt),
    uniqueIndex("bookings_taker_idempotency").on(t.takerId, t.idempotencyKey),
    check("bookings_time_range", sql`${t.startAt} < ${t.endAt}`),
    check("bookings_not_self", sql`${t.takerId} <> ${t.giverId}`),
  ],
);

/**
 * One row per reserved slot. The primary key makes it impossible for two
 * confirmed bookings to hold the same charger slot, even under concurrency.
 */
export const bookingSlotLocks = pgTable(
  "booking_slot_locks",
  {
    chargerId: uuid("charger_id")
      .notNull()
      .references(() => chargers.id, { onDelete: "cascade" }),
    slotStart: ts("slot_start").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.chargerId, t.slotStart] }), index().on(t.bookingId)],
);

export const confirmationCodes = pgTable(
  "confirmation_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    failedAttempts: smallint("failed_attempts").notNull().default(0),
    usedAt: ts("used_at"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.bookingId)],
);

/* ----------------------------------------------------------------------------
 * Charging sessions
 * --------------------------------------------------------------------------*/
export const chargingSessions = pgTable("charging_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "restrict" }),
  status: sessionStatusEnum("status").notNull().default("awaiting_start"),
  codeVerifiedAt: ts("code_verified_at"),
  startedAt: ts("started_at"),
  endedAt: ts("ended_at"),
  completedAt: ts("completed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const batteryReadings = pgTable(
  "battery_readings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chargingSessions.id, { onDelete: "cascade" }),
    kind: readingKindEnum("kind").notNull(),
    percent: smallint("percent").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    recordedAt: ts("recorded_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("battery_readings_session_kind").on(t.sessionId, t.kind),
    check("battery_readings_percent", sql`${t.percent} BETWEEN 0 AND 100`),
  ],
);

/* ----------------------------------------------------------------------------
 * Billing & payments
 * --------------------------------------------------------------------------*/
export type InvoiceLine = { code: string; label: string; amountPaise: number; detail?: string };

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id),
    sessionId: uuid("session_id")
      .notNull()
      .unique()
      .references(() => chargingSessions.id),
    method: billingMethodEnum("method").notNull().default("battery_estimate"),
    batteryKwh: numeric("battery_kwh", { precision: 6, scale: 2, mode: "number" }).notNull(),
    startPercent: smallint("start_percent").notNull(),
    endPercent: smallint("end_percent").notNull(),
    billableWh: integer("billable_wh").notNull(),
    pricePerKwhPaise: integer("price_per_kwh_paise").notNull(),
    energyChargePaise: integer("energy_charge_paise").notNull(),
    platformFeePaise: integer("platform_fee_paise").notNull(),
    taxPaise: integer("tax_paise").notNull(),
    adjustmentPaise: integer("adjustment_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    giverEarningsPaise: integer("giver_earnings_paise").notNull(),
    lines: jsonb("lines").$type<InvoiceLine[]>().notNull(),
    status: invoiceStatusEnum("status").notNull().default("open"),
    issuedAt: ts("issued_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
  },
  (t) => [
    check("invoices_amounts_nonneg", sql`${t.totalPaise} >= 0 AND ${t.energyChargePaise} >= 0`),
    check(
      "invoices_total_consistent",
      sql`${t.totalPaise} = ${t.energyChargePaise} + ${t.platformFeePaise} + ${t.taxPaise} + ${t.adjustmentPaise}`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    provider: paymentProviderEnum("provider").notNull(),
    providerOrderId: text("provider_order_id").notNull(),
    providerPaymentId: text("provider_payment_id"),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentStatusEnum("status").notNull().default("created"),
    method: text("method"),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_provider_order").on(t.provider, t.providerOrderId),
    index().on(t.invoiceId),
    // At most one successful payment per invoice.
    uniqueIndex("payments_one_captured_per_invoice")
      .on(t.invoiceId)
      .where(sql`${t.status} = 'captured'`),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: paymentProviderEnum("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: ts("processed_at"),
    error: text("error"),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_provider_event").on(t.provider, t.eventId)],
);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    giverId: uuid("giver_id")
      .notNull()
      .references(() => users.id),
    amountPaise: integer("amount_paise").notNull(),
    status: payoutStatusEnum("status").notNull().default("requested"),
    providerRef: text("provider_ref"),
    note: text("note"),
    confirmedAt: ts("confirmed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.giverId), check("payouts_positive", sql`${t.amountPaise} > 0`)],
);

/** Ledger of what each homeowner earned per paid booking. */
export const earnings = pgTable(
  "earnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    giverId: uuid("giver_id")
      .notNull()
      .references(() => users.id),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    grossPaise: integer("gross_paise").notNull(),
    platformFeePaise: integer("platform_fee_paise").notNull(),
    netPaise: integer("net_paise").notNull(),
    status: earningStatusEnum("status").notNull().default("unpaid"),
    payoutId: uuid("payout_id").references(() => payouts.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.giverId, t.status)],
);

/* ----------------------------------------------------------------------------
 * Engagement
 * --------------------------------------------------------------------------*/
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    subjectUserId: uuid("subject_user_id")
      .notNull()
      .references(() => users.id),
    chargerId: uuid("charger_id").references(() => chargers.id),
    direction: reviewDirectionEnum("direction").notNull(),
    rating: smallint("rating").notNull(),
    comment: text("comment").notNull().default(""),
    hiddenAt: ts("hidden_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_one_per_author_booking").on(t.bookingId, t.authorId),
    index().on(t.subjectUserId),
    index().on(t.chargerId),
    check("reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

export const reviewReports = pgTable(
  "review_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("review_reports_one_per_reporter").on(t.reviewId, t.reporterId)],
);

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    category: text("category").notNull(),
    description: text("description").notNull(),
    status: disputeStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.reporterId), index().on(t.status)],
);

export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  details: jsonb("details"),
  createdAt: createdAt(),
});

/** Append-only audit trail for booking, charging and payment state changes. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    meta: jsonb("meta"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entityType, t.entityId)],
);

/* ----------------------------------------------------------------------------
 * Relations (for the query builder)
 * --------------------------------------------------------------------------*/
export const usersRelations = relations(users, ({ many }) => ({
  vehicles: many(vehicles),
  chargers: many(chargers),
}));
export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  user: one(users, { fields: [vehicles.userId], references: [users.id] }),
}));
export const chargersRelations = relations(chargers, ({ one, many }) => ({
  owner: one(users, { fields: [chargers.ownerId], references: [users.id] }),
  photos: many(chargerPhotos),
  rules: many(availabilityRules),
  blocks: many(availabilityBlocks),
}));
export const chargerPhotosRelations = relations(chargerPhotos, ({ one }) => ({
  charger: one(chargers, { fields: [chargerPhotos.chargerId], references: [chargers.id] }),
}));
export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  charger: one(chargers, { fields: [availabilityRules.chargerId], references: [chargers.id] }),
}));
export const availabilityBlocksRelations = relations(availabilityBlocks, ({ one }) => ({
  charger: one(chargers, { fields: [availabilityBlocks.chargerId], references: [chargers.id] }),
}));
export const bookingsRelations = relations(bookings, ({ one }) => ({
  charger: one(chargers, { fields: [bookings.chargerId], references: [chargers.id] }),
  taker: one(users, { fields: [bookings.takerId], references: [users.id], relationName: "taker" }),
  giver: one(users, { fields: [bookings.giverId], references: [users.id], relationName: "giver" }),
  vehicle: one(vehicles, { fields: [bookings.vehicleId], references: [vehicles.id] }),
  session: one(chargingSessions, { fields: [bookings.id], references: [chargingSessions.bookingId] }),
  invoice: one(invoices, { fields: [bookings.id], references: [invoices.bookingId] }),
}));
export const chargingSessionsRelations = relations(chargingSessions, ({ one, many }) => ({
  booking: one(bookings, { fields: [chargingSessions.bookingId], references: [bookings.id] }),
  readings: many(batteryReadings),
}));
export const batteryReadingsRelations = relations(batteryReadings, ({ one }) => ({
  session: one(chargingSessions, { fields: [batteryReadings.sessionId], references: [chargingSessions.id] }),
}));
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  booking: one(bookings, { fields: [invoices.bookingId], references: [bookings.id] }),
  payments: many(payments),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));
export const reviewsRelations = relations(reviews, ({ one }) => ({
  author: one(users, { fields: [reviews.authorId], references: [users.id] }),
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
}));

export type User = typeof users.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Charger = typeof chargers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ChargingSession = typeof chargingSessions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
