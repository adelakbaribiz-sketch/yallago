# Architecture — YallaGo Platform

## High-Level Architecture

YallaGo is built as a **modular monolith** on Next.js 16. Domain boundaries are enforced at the file/module level (auth, dispatch, pricing, geo) rather than via microservices. This keeps operational complexity low while preserving the ability to extract services later.

### Layers

1. **Presentation** — React components in `src/components/{customer,driver,admin,shared,map}/`
2. **API** — Next.js Route Handlers in `src/app/api/...`
3. **Domain logic** — Pure TypeScript in `src/lib/{dispatch,pricing,geo,auth,crypto}.ts`
4. **Persistence** — Prisma schema in `prisma/schema.prisma`, client in `src/lib/db.ts`
5. **Real-time** — Socket.io mini-service in `mini-services/realtime/`

### Request Flow

```
Browser → Caddy gateway (port 81) → Next.js (port 3000) → Route Handler → Domain Logic → Prisma → SQLite
                                              ↓
                                    (WebSocket) → Socket.io (port 3003)
```

### Authentication

- Cookie-based sessions (`platform_session`)
- PBKDF2 password hashing (sha512, 100k iterations)
- Sessions stored in DB (revocable)
- 7-day expiry with sliding window

### Role-Based Access Control

| Role     | Permissions                                                  |
|----------|--------------------------------------------------------------|
| CUSTOMER | Create orders, view own orders, rate, manage own profile    |
| DRIVER   | Apply, set availability, accept/reject offers, manage trips |
| ADMIN    | Dashboard, customer management, driver verification, orders, pricing |

Every API route enforces role checks at the entry point.

### Object-Level Authorization

- Customers can only access their own orders (`order.customerId === user.id`)
- Drivers can only access orders assigned to them (`order.driverId === user.driverId`)
- Admins can access all orders

### State Machine

Implemented in `src/lib/dispatch.ts` via `canTransition(from, to)`:

```typescript
const ALLOWED_TRANSITIONS = {
  REQUESTED: ['SEARCHING', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SYSTEM', 'EXPIRED'],
  SEARCHING: ['DRIVER_ASSIGNED', 'NO_DRIVER_AVAILABLE', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SYSTEM'],
  DRIVER_ASSIGNED: ['DRIVER_ARRIVING', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER'],
  ...
}
```

All transitions are validated server-side. Each transition records an `OrderEvent` row.

### Dispatch Concurrency

Atomic assignment uses a database transaction with conditional update:

```sql
UPDATE "Order"
SET driverId = ?, status = 'DRIVER_ASSIGNED', assignedAt = ?
WHERE id = ? AND status IN ('REQUESTED', 'SEARCHING') AND driverId IS NULL
```

If zero rows are updated, another driver won the race.

### Pricing Versioning

Each pricing update:
1. Sets `isActive=false`, `effectiveTo=now()` on the current version
2. Creates a new record with `version = oldVersion + 1`
3. Records an `AuditLog` entry

Historical orders keep their `pricingConfigVersion` reference, so old invoices are never modified.

### Financial Ledger

On order completion, three ledger entries are created:
- `CUSTOMER_CHARGE` (+fare) — debited from customer
- `DRIVER_CREDIT` (+driverNet) — credited to driver (fare minus commission)
- `PLATFORM_COMMISSION` (+commission) — credited to platform

Each entry has a unique `transactionRef`, timestamp, currency, and reference to the originating order.

### Real-Time

Socket.io service on port 3003 with room-based isolation:
- `customer:<userId>` — receives order status updates
- `driver:<driverId>` — receives new service requests
- `order:<orderId>` — receives driver location updates
- `admin` — receives all driver locations

Frontend connects via the gateway: `io('/?XTransformPort=3003')`.

### Maps

Provider-independent interface in `src/lib/geo.ts`:

```typescript
export function searchAddresses(query: string): Address[]
export function reverseGeocode(lat: number, lng: number): string
export function simulateRoute(a: LatLng, b: LatLng): LatLng[]
export function haversineKm(a: LatLng, b: LatLng): number
```

To swap in Google Maps / Mapbox / OSRM, replace these functions without changing call sites.

### File Uploads

Driver documents (license, profile photo, vehicle images) are currently stored as URL strings in the DB. Production should:
1. Add a `/api/upload` endpoint that streams to S3-compatible storage
2. Validate file types and sizes
3. Scan for malware
4. Store only the resulting URL in the DB

## Scaling Considerations

### Database

- SQLite is fine for demo. Production should use PostgreSQL with PostGIS for geographic indexing of driver locations.
- Add indexes on `Order(status, serviceCategoryId)`, `Order(customerId, createdAt)`, `Order(driverId, status)`, `DriverLocation(driverId, isOnline, lastSeenAt)` (already in schema).

### Real-Time

- Socket.io can scale horizontally with the `@socket.io/redis-adapter` for multi-node deployments.
- Driver location updates should be throttled (every 4-5 seconds is sufficient for ride tracking).

### Background Jobs

Currently missing. Production should add:
- BullMQ (Redis-backed) for offer expiration, scheduled orders, payout processing, notification retries
- A cron-like scheduler for daily reports

### Caching

Currently none. Production should add:
- Redis for session storage (faster revocation)
- Redis for pricing config (avoid DB hit on every estimate)
- In-memory cache for service catalog (rarely changes)
