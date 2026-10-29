# Security

YallaGo is a demo. The security measures below are implemented, but several critical production-grade controls are missing. Do not deploy this to production without addressing the gaps in the "Known gaps" section.

## What's implemented

### Authentication

- **Password hashing**: PBKDF2 with SHA-512, 100,000 iterations, 64-byte key length, 16-byte random salt. Stored as `pbkdf2$100000$<salt>$<hash>`.
- **Session tokens**: 32-byte cryptographically random tokens (`crypto.randomBytes(32).toString('hex')`), stored in the `Session` table with a 7-day expiry.
- **Cookie security**: Sessions are stored in an HTTP-only cookie (`HttpOnly; SameSite=Lax`). In production, add `Secure` (HTTPS-only) via a reverse proxy.
- **Session revocation**: Deleting the `Session` row immediately invalidates the cookie on the next request.

### Authorization

- **Role-based access control (RBAC)**: Three roles (`CUSTOMER`, `DRIVER`, `ADMIN`). Every API route checks `user.role` and returns 403 for unauthorized access.
- **Object-level authorization**:
  - Customers can only access their own orders (`order.customerId === user.id`).
  - Drivers can only access orders assigned to them (`order.driverId === user.driverId`).
  - Admins can access all orders.
- **Driver approval gate**: Drivers with `status = PENDING` or `REJECTED` cannot log in. The login endpoint returns `DRIVER_PENDING_APPROVAL` or `DRIVER_REJECTED` (403).
- **Admin role separation**: The `AdminProfile` model supports six admin roles (`SUPER_ADMIN`, `OPERATIONS_MANAGER`, `CUSTOMER_SUPPORT`, `DRIVER_VERIFICATION`, `FINANCE_OFFICER`, `REGIONAL_MANAGER`) with a `permissions` JSON field. The current implementation grants all permissions to all admins; production should enforce per-role permission checks.

### Input validation

- All API routes validate required fields and return 400 for malformed input.
- Zod schemas are available for form validation on the client (via `react-hook-form`).
- SQL injection is prevented by Prisma's parameterized queries — no raw SQL is used anywhere.

### Concurrency

- **Atomic driver dispatch**: Driver acceptance uses a database transaction with a conditional `UPDATE ... WHERE status IN (...) AND driverId IS NULL`. If two drivers race to accept the same order, only one succeeds; the other receives `ALREADY_ASSIGNED`.
- **State machine validation**: Every state transition is validated against an allow-list (`ALLOWED_TRANSITIONS` in `src/lib/dispatch.ts`). Illegal transitions return 400 with `INVALID_TRANSITION:from->to`.

### Audit

- **OrderEvent**: Every order state transition records an event with `eventType`, `fromStatus`, `toStatus`, `actorId`, `actorType`, `metadataJson`, and `createdAt`.
- **AuditLog**: Admin actions (driver approval, driver rejection, customer suspension, pricing changes, order status overrides) record the actor, action, resource type/ID, and metadata.
- **LedgerEntry**: Every financial event (customer charge, driver credit, platform commission, refund, payout) has a unique `transactionRef`, timestamp, currency, and reference to the originating order.

### Real-time isolation

- Socket.io rooms are keyed by user ID and driver ID — a customer only receives events tagged to their own `customer:<userId>` room.
- Driver location broadcasts go only to `order:<orderId>` rooms, which only the active-order customer has joined.
- Admins join an `admin` room and receive all driver locations (for the dashboard's online-driver view).

### Secrets

- No secrets are committed to the repository. The only environment variable is `DATABASE_URL`, which points to a local SQLite file.
- Passwords are never logged. Session tokens are never logged. The Prisma client's query logging is enabled in development but should be disabled in production.

## Known gaps (must fix before production)

### Critical

1. **No rate limiting** on auth endpoints. A malicious actor could brute-force passwords at line rate.
   - Fix: Add a middleware that rate-limits `/api/auth` by IP + email. Consider `express-rate-limit` or Cloudflare rate-limiting rules.

2. **No CSRF protection**. State-changing endpoints rely on `SameSite=Lax` cookies. This is sufficient for modern browsers but not a complete defense — a sophisticated attack could still exploit it.
   - Fix: Add CSRF tokens (synchronizer token pattern) for all state-changing requests. Validate server-side.

3. **No Content Security Policy** headers. The app is vulnerable to XSS if any user input is rendered without escaping (though React escapes by default, so this is a defense-in-depth gap, not an active vulnerability).
   - Fix: Add a CSP header in `next.config.ts` that disallows inline scripts (except Next.js's required inline scripts) and external resources except from trusted domains.

4. **No file upload scanning**. Driver documents (license, vehicle registration, insurance) are stored as URL strings. When you add a real upload endpoint, scanned documents could contain malware.
   - Fix: Stream uploads to S3, scan with ClamAV, validate file types via magic bytes (not just extension).

5. **No `Strict-Transport-Security` header**. Should be set by the reverse proxy (Caddy, nginx) in production to force HTTPS.

### Significant

6. **No data retention workflow**. Location history, completed orders, and inactive user accounts accumulate forever. GDPR and similar regulations require deletion after a retention period.
   - Fix: Add a background job that anonymizes or deletes records older than the configured retention period.

7. **Float monetary amounts**. The `LedgerEntry.amount` and `Order.estimatedFare` / `finalFare` fields use Prisma `Float`, which is a 64-bit IEEE 754 float. This can cause rounding errors in financial calculations.
   - Fix: Switch to `Decimal` (Prisma maps to `DECIMAL(19,4)` in PostgreSQL). Recompute all monetary aggregates with `Decimal` math.

8. **No audit log retention policy**. The `AuditLog` table grows forever.
   - Fix: Add a retention job that moves audit logs older than 7 years (or whatever your jurisdiction requires) to cold storage.

9. **No ` HttpOnly; Secure; SameSite=Strict`** on the session cookie. The current cookie is `SameSite=Lax` (sufficient for most cases but `Strict` is safer for a banking-grade app).

10. **No IP-based session pinning**. A stolen session cookie can be used from any IP.
    - Fix: Store the IP and User-Agent on the `Session` row and validate them on every request. If they don't match, force re-authentication.

### Operational

11. **No Sentry or error tracking**. Errors are logged to the console but not aggregated.
    - Fix: Add Sentry for both client and server error tracking.

12. **No uptime monitoring**. If the app goes down, nobody knows until a user complains.
    - Fix: Add a `/api/health` endpoint that checks database connectivity. Wire it to an uptime monitor (Pingdom, UptimeRobot, or Cloudflare Workers).

13. **No dependency vulnerability scanning**. `bun install` doesn't check for known vulnerabilities.
    - Fix: Add `bun audit` to CI. Or use Snyk / Dependabot.

## Threat model

### Asset: User passwords

- **Threat**: Database leak exposes password hashes.
- **Mitigation**: PBKDF2 with 100k iterations makes brute-force expensive. Each password has a unique salt, so rainbow tables don't work.
- **Residual risk**: If the database leaks, an attacker with significant compute could crack weak passwords. Encourage strong passwords (or add a password strength meter).

### Asset: Session cookies

- **Threat**: XSS attack steals the cookie.
- **Mitigation**: HTTP-only cookies can't be read by JavaScript. SameSite=Lax prevents cross-site request forgery.
- **Residual risk**: A sophisticated XSS attack could still make authenticated requests on behalf of the user (even without stealing the cookie). CSP would mitigate this further.

### Asset: Driver location history

- **Threat**: A compromised admin account exports all driver location history.
- **Mitigation**: Only admins can access `/api/drivers/online`. The endpoint returns only currently-online drivers, not historical locations.
- **Residual risk**: A malicious admin with database access could query `DriverLocation` directly. Add row-level audit logging on the database.

### Asset: Financial ledger

- **Threat**: A bug or attack corrupts the ledger.
- **Mitigation**: Every entry has a unique `transactionRef`. Entries are append-only (no updates). Corrections are recorded as new `ADJUSTMENT` entries, never overwrites.
- **Residual risk**: A database compromise could still modify or delete entries. Use database-level audit logging and regular backups.

### Asset: Customer PII (name, email, phone)

- **Threat**: A customer support agent with limited access exports customer data.
- **Mitigation**: Object-level authorization limits what each role can see. (Currently, all admins see all customers — production should enforce per-region or per-tier access.)
- **Residual risk**: A malicious admin with database access could export everything. Encrypt PII at rest (PostgreSQL `pgcrypto`) for additional defense.

## Hardening checklist (before production)

- [ ] Add rate limiting on `/api/auth` (per IP + email)
- [ ] Add CSRF tokens for state-changing endpoints
- [ ] Add Content Security Policy header
- [ ] Add `Strict-Transport-Security` header (via reverse proxy)
- [ ] Switch session cookie to `SameSite=Strict; Secure`
- [ ] Add IP + User-Agent pinning on sessions
- [ ] Migrate monetary fields to `Decimal`
- [ ] Add file upload endpoint with malware scanning
- [ ] Add data retention job (GDPR compliance)
- [ ] Add Sentry for error tracking
- [ ] Add `/api/health` endpoint + uptime monitor
- [ ] Add `bun audit` to CI
- [ ] Implement per-admin-role permission enforcement
- [ ] Add database-level audit logging
- [ ] Encrypt PII at rest (pgcrypto)
- [ ] Add backup + restore documentation
- [ ] Add incident response playbook
