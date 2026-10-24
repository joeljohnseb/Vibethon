# Eber — home EV charging marketplace

Eber connects EV drivers with homeowners who share their private chargers. Drivers find chargers nearby, book a slot, start the session with a one-time code, and pay for the battery energy they gained. Hosts list chargers, approve bookings, record battery readings and track their earnings.

**Stack:** Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS 4 · PostgreSQL via Drizzle ORM · Leaflet + OpenStreetMap · Razorpay · Twilio · Vitest + Playwright.

## Quick start (no accounts or keys needed)

```bash
npm install
npm run setup      # create the database and load demo data
npm run dev        # http://localhost:3000
```

Without `DATABASE_URL`, Eber uses **embedded Postgres (PGlite)** stored in `./.data/pglite`, so you don't need to install anything. Without API keys it runs in **test mode**: a banner says so, SMS codes are shown on screen, and a simulated payment gateway replaces Razorpay. Test-mode payments still go through the same signed-webhook checks as real ones.

> Stop `npm run dev` before running `db:*` commands. The embedded database allows only one process at a time.

### Demo accounts (password `Eber@1234`)

| Email | What to try |
|---|---|
| `driver@eber.dev` | Has a **confirmed booking starting within the hour**. Open it and tap "Show my start code". |
| `host@eber.dev` | Verify that code under Host → Bookings, record start and end %, and approve the pending request. |
| `diya@eber.dev`, `rohan@eber.dev`, `anjali@eber.dev` | More drivers and hosts (Bengaluru and Kochi listings). |
| `newhost@eber.dev` | Host without a verified phone, so it can't publish until it verifies one. |
| `admin@eber.dev` | Admin console at `/admin`. |

`npm run db:reset` wipes and reseeds the database (fresh relative dates).

## Scripts

| | |
|---|---|
| `npm run dev` | Migrate, then start the dev server |
| `npm test` | Unit and integration tests (in-memory Postgres): billing, booking conflicts, codes, payments, reviews |
| `npm run test:e2e` | Playwright: full two-browser journey, plus a horizontal-overflow check on mobile (needs seed data) |
| `npm run db:generate` | Generate a SQL migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:reset` | Database management |
| `npm run build && npm start` | Production build |

## How the core flows work

**Booking.** Availability is weekly rules (in the charger's timezone) minus blocked periods and reserved slots. Confirming a booking inserts one row per slot into `booking_slot_locks`, whose primary key is `(charger_id, slot_start)`. Postgres itself therefore rejects double bookings, even when requests arrive at the same moment (there is a test for this). Approval is the default; listings can switch to instant booking. Approving one request automatically declines any pending requests that overlap it. Unanswered requests expire at their start time.

**Pricing snapshot.** Each booking stores the price per kWh, fee settings and vehicle battery capacity at the moment it is made. Later edits to the listing or vehicle don't change its bill.

**Shared-code start** (`src/lib/services/charging.ts`).
- The driver generates a 6-digit code from 30 minutes before the slot. Only an HMAC of it is stored, keyed with the server secret and the booking id, so a code only works for its own booking.
- Codes expire after 10 minutes, are single-use, and are revoked after 5 wrong attempts. Generating a new code revokes the previous one. All checks happen on the server inside a transaction.
- After verifying the code, the host records the starting battery %, which starts the session. Later they record the ending %. The server checks 0 ≤ start ≤ end ≤ 100.

**Billing** (`src/lib/billing.ts`, pure functions).

`energy (Wh) = capacity × (end% − start%) / 100`, and `charge = energy × agreed ₹/kWh`.

Platform fee and tax apply only when configured (`PLATFORM_FEE_BPS`, `PLATFORM_FEE_FIXED_PAISE`, `TAX_BPS`), and each appears as its own line. Bills under ₹1 get a disclosed "minimum payment" line, because gateways can't charge less. The UI tells users this is a battery estimate: wall consumption is higher because of charging losses. Passing `method: "meter"` with `meterWh` switches billing to real meter readings later.

**Payments** (`src/lib/services/payments.ts`).
- One gateway order per invoice, reused on retry, so a driver can't be charged twice.
- A session is marked completed only by either:
  - a webhook whose signature verifies (HMAC), or
  - a Checkout callback whose signature verifies and whose status the server then re-fetches from the Razorpay API.
- Webhooks are de-duplicated by event id in `webhook_events`.
- Amount mismatches are ignored and logged. A late failure after a success is ignored. A capture on a second order after the invoice is already paid raises a duplicate-payment dispute for a refund.
- A failed payment leaves the session in `payment_failed` so the driver can retry.
- Paying creates an `earnings` row for the host. A payout shows as "Transferred" only after an admin confirms it with a bank/UTR reference.

**States** (`src/lib/state.ts`). Every status change goes through `assertTransition`:
- booking: `pending → confirmed | rejected | cancelled | expired`, `confirmed → cancelled | completed`
- session: `awaiting_start → active → awaiting_payment ⇄ payment_pending / payment_failed → completed`

Every change is written to `audit_logs`.

**Privacy and security.**
- Before confirmation, drivers see only a stable location within about 600 m.
- The exact address, access instructions and the other party's phone number appear only after confirmation.
- Passwords use scrypt. Session tokens, OTPs and start codes are stored only as hashes. Cookies are httpOnly and SameSite=Lax.
- Server actions have built-in origin checks. Rate limits cover login, OTP, codes, uploads and disputes.
- Uploads are checked by magic bytes, then re-encoded with sharp, which also strips EXIF/GPS data.
- Admin rights and resource ownership are checked in every service function, not by hiding UI. Other users' bookings return "not found".

## Going to production

1. Use a real PostgreSQL (`DATABASE_URL`), then run `npm run db:migrate`.
2. Set `APP_SECRET`, `APP_URL`, and the Razorpay keys plus webhook secret (start with `rzp_test_` keys). Set Twilio for SMS and Google OAuth for Google sign-in.
3. Call `GET /api/cron/maintenance` with `Authorization: Bearer $CRON_SECRET` every 5 minutes. A throttled fallback also runs on page loads.
4. Replace the filesystem storage in `src/lib/storage.ts` with S3/R2/Supabase Storage. Move rate limiting (`src/lib/ratelimit.ts`) to Redis if you run more than one instance.
5. Automate host payouts with Razorpay Route or RazorpayX. Today admins confirm payouts manually at `/admin/payouts`.
6. Have the template Terms and Privacy pages reviewed by a lawyer (DPDP Act).

## Project layout

```
src/lib/db/schema.ts      25 tables with constraints (checks, unique and partial indexes)
src/lib/services/*        all business logic and authorization (tested directly)
src/lib/billing.ts        billing maths       src/lib/state.ts   state machines
src/lib/auth/*            sessions, scrypt, OTP, Google OAuth (PKCE)
src/lib/payments/*        Razorpay client and the test-mode gateway
src/app/actions/*         server actions (thin wrappers over services)
src/app/**                pages: public, driver (/bookings…), host (/host…), shared, /admin
tests/                    Vitest   e2e/   Playwright   drizzle/   SQL migrations
```
