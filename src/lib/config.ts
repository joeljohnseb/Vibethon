import "server-only";

function int(name: string, fallback: number) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
  return n;
}

const isProd = process.env.NODE_ENV === "production" && !process.env.EBER_TEST;

function secret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd) throw new Error("APP_SECRET must be set (at least 32 characters) in production");
  return "dev-only-insecure-secret-change-me-0123456789";
}

/** Sandbox (test-mode) integrations are allowed in development, or explicitly in production. */
const sandboxAllowed = !isProd || process.env.EBER_ALLOW_SANDBOX === "true";

export const config = {
  isProd,
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  get secret() {
    return secret();
  },
  sandboxAllowed,
  billing: {
    // Charges are only added when explicitly configured. Defaults: none.
    platformFeeBps: int("PLATFORM_FEE_BPS", 0),
    platformFeeFixedPaise: int("PLATFORM_FEE_FIXED_PAISE", 0),
    taxBps: int("TAX_BPS", 0),
  },
  payments: {
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    get mode(): "razorpay" | "sandbox" | "disabled" {
      if (this.razorpayKeyId && this.razorpayKeySecret) return "razorpay";
      return sandboxAllowed ? "sandbox" : "disabled";
    },
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },
  sms: {
    twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
    twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
    twilioFrom: process.env.TWILIO_FROM_NUMBER || "",
    get mode(): "twilio" | "sandbox" | "disabled" {
      if (this.twilioSid && this.twilioToken && this.twilioFrom) return "twilio";
      return sandboxAllowed ? "sandbox" : "disabled";
    },
  },
  email: {
    resendKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "Eber <no-reply@eber.local>",
  },
  storageDir: process.env.STORAGE_DIR || "./.data/uploads",
  cronSecret: process.env.CRON_SECRET || "",
  defaultSearchRadiusKm: 10,
};
