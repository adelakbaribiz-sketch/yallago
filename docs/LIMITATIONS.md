# Limitations

A candid list of what YallaGo does NOT do. This is a demo / prototype — these are the gaps you'd need to close before putting it in front of real customers.

## Critical gaps (would block production launch)

### No real payment processing

The payment provider is `MOCK`. No card is ever charged, no money ever moves. The `PaymentProvider` enum includes `STRIPE`, `PAYPAL`, and `LOCAL_GATEWAY` stubs, but no adapter is implemented.

**To fix**: Implement a Stripe adapter with webhook signature verification, idempotent webhook handling, and refund flows. Add a `/api/webhooks/stripe` endpoint.

### No background job system

Offer expiration uses client-side polling — the driver app polls `/api/drivers/me/requests` every 3 seconds. There is no server-side scheduler to expire offers after the 15-second TTL, no scheduled-order dispatch, no automated payout processing, no notification retries.

**To fix**: Add BullMQ (Redis-backed) with workers for: offer expiration, scheduled order dispatch, daily payout processing, notification delivery retries, driver document expiration reminders.

### No real OTP / SMS verification

Phone numbers are stored on the `User` model but never verified. Anyone can register with any phone number.

**To fix**: Integrate an SMS provider (Twilio, Kavenegar), add a `phoneVerified` flag, send a 6-digit code on registration and login, verify it via a `/api/auth/verify-otp` endpoint.

### No real push notifications

The `Notification` model exists and notifications are written to the database, but they are never delivered to mobile devices. There's no FCM (Android) or APNs (iOS) integration.

**To fix**: Add a push notification service that reads pending `Notification` rows and sends them via FCM/APNs. The Socket.io service already handles in-app real-time, but mobile push needs a separate path.

### No automated test suite

The platform has been manually verified end-to-end via curl scripts and Agent Browser, but there are no unit or integration tests.

**To fix**: Add Vitest for unit tests (pricing calculations, state machine transitions, dispatch ranking). Add Playwright or Cypress for E2E tests covering the six workflows in the original brief (car ride, moto delivery, cargo, concurrency, authorization, payment reliability).

## Significant gaps (would limit production scale)

### SQLite, not PostgreSQL

SQLite is fine for the demo but has real limitations for a production ride-hailing platform:

- No concurrent writes (single-writer lock).
- No PostGIS for geographic queries — driver dispatch uses Haversine distance computed in JavaScript, which means scanning all online drivers on every dispatch.
- No `SELECT FOR UPDATE` (worked around with conditional `UPDATE`, but still).

**To fix**: Switch the Prisma `datasource` to PostgreSQL with PostGIS. Add a `geo` index on `DriverLocation` for spatial queries. Migrate via `prisma migrate`.

### No rate limiting

Auth endpoints (`/api/auth` login) have no rate limiting. A malicious actor could brute-force passwords.

**To fix**: Add `next-safe-action` or a middleware that rate-limits by IP + email. Or put the app behind Cloudflare with rate-limiting rules.

### No CSRF protection

State-changing endpoints rely on the `SameSite=Lax` cookie attribute for CSRF protection. This is sufficient for modern browsers but not a complete defense.

**To fix**: Add CSRF tokens for all state-changing requests, validated server-side.

### No file upload scanning

Driver documents (license, vehicle registration, insurance) are stored as URL strings. There's no file upload endpoint, no malware scanning, no file type validation.

**To fix**: Add a `/api/upload` endpoint that streams to S3-compatible storage, validates file types and sizes, scans with ClamAV, and stores only the resulting URL.

### No data retention workflow

There's no automated process to delete old data (location history, completed orders, inactive users) to comply with GDPR or similar regulations.

**To fix**: Add a background job that anonymizes or deletes records older than the configured retention period. Add a "delete my account" flow for customers.

## UX / product gaps

### No native mobile apps

This is a responsive Progressive Web App. Native iOS and Android apps would require React Native (with Expo) or separate native development.

### No RTL / Persian localization

The `preferredLanguage` field exists on the `User` model, and `next-intl` is installed, but the UI is English-only with left-to-right layout. A proper Persian (Farsi) translation would require:

- Translation JSON files for all UI strings.
- RTL layout flipping (Tailwind's `rtl:` variant).
- Persian number formatting (`Intl.NumberFormat('fa-IR')`).
- Persian date formatting (Jalali calendar via `date-fns-jalali`).

### No saved payment methods

The customer profile has a `defaultPaymentMethod` field but no UI to manage saved cards. The mock payment provider doesn't tokenize cards.

### No ride scheduling UI

The schema supports `scheduledFor` and the cargo booking form has a scheduled toggle, but there's no calendar UI for customers to pick a future pickup time for car rides.

### No driver scheduling

Drivers can toggle online/offline, but there's no "schedule online hours" feature — drivers can't say "I'll be online tomorrow from 6pm to 10pm".

### No surge pricing UI

The pricing config supports a `peakDemandMultiplier` field in the JSON, but there's no UI to configure it and no algorithm to detect peak demand.

### No support ticket UI

The `SupportTicket` model exists, but there's no UI for customers to file tickets or for admins to manage them. (The schema is ready; the UI is a TODO.)

## Operational gaps

### No Docker / Docker Compose

The app runs via `bun run dev` locally. There's no `Dockerfile`, no `docker-compose.yml`, no production image build.

**To fix**: Add a multi-stage Dockerfile for the Next.js app, a Dockerfile for the realtime mini-service, and a `docker-compose.yml` that wires them together with PostgreSQL and Redis.

### No CI / CD

No GitHub Actions workflow, no automated tests on PR, no automated deployment.

**To fix**: Add a GitHub Actions workflow that runs `bun run lint`, `bun run db:push` on a test database, and (once written) the test suite on every PR.

### No monitoring / alerting

No Sentry for error tracking, no Datadog for metrics, no uptime alerts.

**To fix**: Add Sentry for client and server error tracking. Add a `/api/health` endpoint that checks database connectivity and Redis (when added) and wire it to an uptime monitor.

### No backup / restore documentation

SQLite is a single file, but there's no documentation of how to back it up, how often, or how to restore.

**To fix**: For PostgreSQL, document `pg_dump` schedules and restore procedures. For SQLite, document copying the file and testing the restore on a staging instance.

## Security gaps (see `SECURITY.md` for details)

- No rate limiting on auth endpoints
- No CSRF tokens
- No Content Security Policy headers
- No file upload scanning
- No data retention workflow
- No `Strict-Transport-Security` header (would be set by reverse proxy in production)
- No audit log retention policy (audit logs grow forever)
- Float monetary amounts (should be Decimal for production)
