# Design Decisions

A record of the architectural and design choices behind YallaGo, with the reasoning for each.

## 1. Dark-mode-first UI

**Decision**: The UI defaults to dark mode. A toggle is available in every header, but the first render is dark.

**Why**:

- Ride-hailing apps are disproportionately used at night — customers ordering rides home from dinners, drivers working evening shifts. A dark UI reduces glare on those devices.
- A dark palette makes the warm terracotta brand accent (`oklch(0.68 0.20 32)`) pop, which strengthens brand recognition.
- Map tiles look better in dark mode for a mobility product — CARTO's `dark_all` tiles give a "navigation app at night" feel that matches user expectations from products like Uber and Google Maps' dark mode.
- All dark-theme token pairs were checked against WCAG AA contrast (4.5:1 for body text, 3:1 for large text).

**Implementation**:

- `next-themes` with `defaultTheme="dark"` and `enableSystem={false}` (we don't follow OS preference — we are dark-first, not dark-when-OS-says-so).
- An inline `<script>` in `layout.tsx` sets the `.dark` class on `<html>` before hydration, preventing a flash of unstyled content (FOUC).
- The map component (`MapView.tsx`) listens to `resolvedTheme` and swaps tile layers between OpenStreetMap (light) and CARTO dark tiles.
- Leaflet's controls (zoom, attribution, popups) are restyled in `globals.css` under `.dark` selectors.

## 2. Modular monolith, not microservices

**Decision**: All domain logic (auth, dispatch, pricing, geo) lives in a single Next.js app, separated by file boundaries rather than network boundaries.

**Why**:

- A ride-hailing platform's domains are tightly coupled — a state transition in `Order` triggers a write to `OrderEvent`, a read from `PricingConfiguration`, a write to `LedgerEntry`, and a Socket.io broadcast, all within one logical transaction. Splitting these into microservices would require distributed transactions or saga patterns with no real benefit at demo scale.
- Operational complexity stays low: one process to run, one database to back up, one set of logs to read.
- The boundaries are clean enough that any module can be extracted later. `dispatch.ts` is pure TypeScript with no HTTP dependency; extracting it to a service would mean wrapping it in a route handler and changing two import statements.

**Trade-off**: We lose horizontal scalability of individual domains. If `dispatch` becomes a bottleneck, we can extract it without touching `pricing` or `auth`. But for a demo, the simplicity wins.

## 3. Socket.io mini-service, not Server-Sent Events or long polling

**Decision**: Real-time updates use a separate Socket.io service on port 3003, proxied through the Caddy gateway.

**Why**:

- Socket.io gives us room-based broadcasting for free — `customer:<userId>`, `driver:<driverId>`, `order:<orderId>` — which is exactly the isolation model we need (a customer should only see location updates for their own driver, never anyone else's).
- Bidirectional: drivers can push their location to the server without polling, and the server can push new requests to drivers without them polling.
- The mini-service pattern (separate `bun` process with its own `package.json`) keeps the realtime code isolated from the Next.js bundle, which means a Socket.io bug or version bump can't break the main app.

**Trade-off**: Two processes to run. For a demo this is fine; for production you'd want the realtime service scaled horizontally with `@socket.io/redis-adapter`.

## 4. Prisma + SQLite for development, PostgreSQL-ready schema

**Decision**: Use SQLite for the demo database, but write the schema in a way that's trivially portable to PostgreSQL.

**Why**:

- SQLite is zero-config — `bun run db:push` creates the file, no server to install. This makes the demo runnable in any environment.
- Prisma's schema language is database-agnostic; the only change needed to switch to PostgreSQL is the `datasource` block (`provider = "postgresql"`) and the `DATABASE_URL`.
- The schema avoids SQLite-specific features (no JSON1 extension required — JSON is stored as `String` and parsed in application code).

**Trade-off**: SQLite doesn't support `SELECT FOR UPDATE`, so the atomic dispatch uses a conditional `UPDATE ... WHERE status IN (...) AND driverId IS NULL` pattern instead. This is actually portable to PostgreSQL and is the more robust pattern anyway.

## 5. Versioned pricing configurations

**Decision**: Every pricing change creates a new `PricingConfiguration` row with an incremented `version`. The old row is marked `isActive=false` and given an `effectiveTo` timestamp. Orders store `pricingConfigVersion` at creation time.

**Why**:

- Historical invoices must never silently change when an admin updates pricing. If a customer was charged 50,000 IRR on Monday and the admin raises prices on Tuesday, the Monday invoice must still say 50,000 IRR.
- Storing the version number on the order (rather than a snapshot of the config) keeps the schema normalized — if you need to see what the config was at order creation time, you join on `(serviceCategoryId, vehicleCategoryId, version)`.
- The audit log records who changed the pricing, when, and what the new values are.

**Trade-off**: Pricing reads need a `findFirst` with `ORDER BY version DESC` instead of a simple lookup. Indexed, this is fast enough.

## 6. Atomic dispatch via conditional UPDATE

**Decision**: Driver acceptance happens in a database transaction with a conditional `updateMany`:

```typescript
const updated = await tx.order.updateMany({
  where: { id: orderId, status: { in: ['REQUESTED', 'SEARCHING'] }, driverId: null },
  data: { driverId, status: 'DRIVER_ASSIGNED', assignedAt: new Date() }
})
if (updated.count === 0) {
  // someone else won the race
  return { success: false, reason: 'ALREADY_ASSIGNED' }
}
```

**Why**:

- This is the simplest correct pattern for "first writer wins" concurrency. No explicit row-level locks, no SELECT FOR UPDATE, no application-level mutex.
- SQLite (and PostgreSQL) guarantee that `UPDATE ... WHERE` is atomic at the row level — if two transactions try to update the same row simultaneously, one will see `count=0` because the other's commit changed the row's `status` or `driverId`.
- The transaction also cancels any other outstanding offers for the same order and marks the winning assignment as ACCEPTED, all atomically.

**Trade-off**: Only one driver can accept at a time per order. If we wanted to broadcast to multiple drivers simultaneously (the "batch dispatch" pattern), we'd need to track offers separately and let the first ACCEPT win — which is what `DriverAssignment` is for, but the current dispatch only offers to one driver at a time.

## 7. HTTP-only session cookies, not JWT

**Decision**: Authentication uses server-stored sessions with HTTP-only cookies, not JWT tokens.

**Why**:

- Sessions are revocable — deleting the `Session` row immediately logs the user out on their next request. JWT tokens can't be revoked without a server-side denylist, which defeats the purpose.
- HTTP-only cookies can't be read by JavaScript, which eliminates a whole class of XSS-based token theft.
- The session table is small and indexed by token; lookup is sub-millisecond on SQLite.

**Trade-off**: Every authenticated request hits the database for session lookup. For a demo this is fine; for high-scale production you'd cache sessions in Redis.

## 8. Provider-independent abstractions for maps, payments, SMS

**Decision**: Every external integration goes through a thin abstraction layer:

- `src/lib/geo.ts` — `searchAddresses()`, `reverseGeocode()`, `simulateRoute()`, `haversineKm()`
- `PaymentProvider` enum — `MOCK | STRIPE | PAYPAL | LOCAL_GATEWAY`
- `NotificationChannel` enum — `IN_APP | PUSH | SMS | EMAIL`

**Why**:

- Deployment targets differ. A ride-hailing platform in Iran uses different payment gateways and map providers than one in Brazil or Indonesia. Hard-coding Stripe or Google Maps would make the platform un-deployable in those markets.
- The abstraction means a developer can swap in a real provider by editing one file (`geo.ts`) without touching any call site.
- For the demo, all providers are mocked, which means no API keys are required to run the project.

## 9. shadcn/ui, not a custom design system

**Decision**: Use shadcn/ui (New York style) for all UI primitives.

**Why**:

- shadcn/ui gives us Radix-based accessible primitives (Select, Dialog, Tabs, etc.) with copyable source code, so we can customize any component without forking a library.
- The New York style uses smaller radius and tighter spacing than the default, which matches the "professional tool" aesthetic of a ride-hailing operations dashboard.
- All components are theme-aware via CSS variables, so dark mode "just works" once the `.dark` class is on `<html>`.

## 10. Original brand identity

**Decision**: The platform is called "YallaGo" with an original warm-terracotta accent color. No existing product's name, logo, color, or copy is reused.

**Why**:

- The project brief explicitly said: "Use Snapp as a functional reference only. Do not copy its proprietary source code, trademarks, copyrighted assets, or exact branded interface."
- "Yalla" is a widely-used Arabic/Persian colloquial word meaning "let's go" — appropriate for a ride-hailing product, original as a brand name, and culturally neutral enough to deploy in multiple regions.
- The warm terracotta accent (`oklch(0.68 0.20 32)`) was chosen to be distinguishable from the pink/magenta used by Lyft, the black used by Uber, and the red used by Snapp — while still feeling warm and approachable for a consumer-facing product.
