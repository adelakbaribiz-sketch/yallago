# API Reference

All API routes are under `/api/`. Authentication uses an HTTP-only cookie (`platform_session`). All authenticated requests must include the cookie.

## Authentication

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| POST | `/api/auth` | `{action:"login", email, password}` | `{user}` |
| POST | `/api/auth` | `{action:"register", email, password, fullName, phone, role}` | `{user}` |
| POST | `/api/auth` | `{action:"logout"}` | `{ok: true}` |
| GET | `/api/auth` | — | `{user, driverInfo}` |

**Errors**:
- `INVALID_CREDENTIALS` (401) — wrong email or password
- `EMAIL_TAKEN` (400) — registration email already exists
- `DRIVER_PENDING_APPROVAL` (403) — driver account not yet approved
- `DRIVER_REJECTED` (403) — driver application was rejected

## Service Catalog

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/services` | `{services: ServiceCategory[], regions: ServiceRegion[]}` |

## Pricing

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| POST | `/api/pricing/estimate` | `{serviceCategoryId, vehicleCategoryId?, pickupLat, pickupLng, destinationLat, destinationLng, weightKg?, helpers?, needsLoading?, needsUnloading?, scheduled?, packageDelivery?, oversizedPackage?}` | `{estimate: PriceBreakdown, distanceKm, durationMinutes}` |

**`PriceBreakdown` shape**:
```typescript
{
  baseFare: number
  distanceCharge: number
  durationCharge: number
  bookingFee: number
  surcharges: number
  helpersFee: number
  loadingFee: number
  unloadingFee: number
  weightSurcharge: number
  scheduledServiceFee: number
  estimatedFare: number
  minFare: number
  finalEstimate: number  // = max(minFare, sum of all components)
  currency: string       // "IRR"
  configVersion: number
  breakdown: { label: string, amount: number }[]
}
```

**Errors**: `NO_PRICING_CONFIG` (400) — no active pricing configuration for the given service + vehicle category.

## Orders

### Create order

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/orders` | See below |

```typescript
{
  serviceCategoryId: string
  vehicleCategoryId?: string
  serviceType: 'RIDE' | 'MOTORCYCLE_RIDE' | 'PACKAGE_DELIVERY' | 'CARGO'
  pickup: { lat: number, lng: number, address: string }
  destination: { lat: number, lng: number, address: string }
  details?: Record<string, unknown>     // service-specific payload
  paymentMethod?: 'CASH' | 'CARD' | 'WALLET' | 'INVOICE'
  scheduledFor?: string                 // ISO date
  requiresQuotation?: boolean
  weightKg?: number
  helpers?: number
  needsLoading?: boolean
  needsUnloading?: boolean
}
```

Returns `{order, estimate, dispatchResult}`. If `requiresQuotation` is true (or the service category requires it), the order is created in `QUOTATION_REQUESTED` status and `dispatchResult` is null.

### List orders

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/orders` | `{orders: Order[]}` |

Returns orders based on the caller's role:
- Customer: only their own orders
- Driver: only orders assigned to them
- Admin: all orders

### Get order details

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/orders/[id]` | `{order, driverLocation}` |

Includes `serviceCategory`, `customer`, `driver` (with `user` and `vehicles`), `events`, `ratings`, `payments`. `driverLocation` is the driver's latest GPS ping (only if assigned and online).

### State transition (generic)

| Method | Endpoint | Body |
|---|---|---|
| PUT | `/api/orders/[id]` | `{toStatus: string, cancelReason?: string}` |

Validates the transition against `ALLOWED_TRANSITIONS` in `src/lib/dispatch.ts`. Returns 400 with `INVALID_TRANSITION:from->to` for illegal transitions.

### Order action endpoints

| Method | Endpoint | Caller | Effect |
|---|---|---|---|
| POST | `/api/orders/[id]/cancel` | Customer or Driver | Transitions to `CANCELLED_BY_CUSTOMER` or `CANCELLED_BY_DRIVER` |
| POST | `/api/orders/[id]/rate` | Customer or Driver | Creates a `Rating` row; updates driver's aggregate rating |
| POST | `/api/orders/[id]/accept` | Driver | Atomic assignment via DB transaction |
| POST | `/api/orders/[id]/reject` | Driver | Marks assignment `REJECTED`, re-dispatches |
| POST | `/api/orders/[id]/arrive` | Driver | Toggles `DRIVER_ARRIVING` ↔ `DRIVER_ARRIVED` |
| POST | `/api/orders/[id]/start` | Driver | Transitions to `IN_PROGRESS` (ride) or `LOADING` (cargo) or `IN_TRANSIT` (delivery) |
| POST | `/api/orders/[id]/complete` | Driver | Transitions to `COMPLETED`; creates 3 `LedgerEntry` rows |
| POST | `/api/orders/[id]/confirm-delivery` | Customer | Confirms package delivery (verifies code if set) |
| POST | `/api/orders/[id]/quotation` | Admin | Approves or rejects cargo quotation |

**Accept errors**:
- `ORDER_NOT_FOUND` (404)
- `ORDER_NOT_DISPATCHABLE` — order is not in `SEARCHING` or `REQUESTED` state
- `ALREADY_ASSIGNED` — another driver won the race
- `NO_VALID_OFFER` — driver has no active `OFFERED` assignment for this order

## Drivers

| Method | Endpoint | Body / Purpose |
|---|---|---|
| POST | `/api/drivers/apply` | Submit or update driver application (license, vehicle, service categories) |
| GET | `/api/drivers/apply` | Get current driver's profile |
| GET | `/api/drivers/me/availability` | Get online/offline status + last known location |
| PATCH | `/api/drivers/me/availability` | `{isOnline, latitude?, longitude?}` — toggle online |
| POST | `/api/drivers/me/location` | `{latitude, longitude, heading?, speed?, accuracy?}` — update GPS |
| GET | `/api/drivers/me/requests` | List incoming `OFFERED` + active `ACCEPTED` assignments |
| GET | `/api/drivers/me/orders` | List driver's order history (50 most recent) |
| GET | `/api/drivers/me/earnings?from=&to=` | Earnings summary for date range (default: last 30 days) |
| GET | `/api/drivers/online` | List all online approved drivers (admin / customer) |

## Admin

| Method | Endpoint | Body / Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | KPI metrics + service performance + recent orders |
| GET | `/api/admin/customers?search=&page=&pageSize=` | Search/list customers |
| PATCH | `/api/admin/customers` | `{id, status}` — suspend or reactivate customer |
| GET | `/api/admin/drivers?status=&page=&pageSize=` | List drivers (filter by status) |
| POST | `/api/admin/drivers/[id]/approve` | Approve driver + their pending vehicles |
| POST | `/api/admin/drivers/[id]/reject` | `{reason, action?: "reject" \| "suspend"}` — reject or suspend |
| GET | `/api/admin/orders?status=&serviceType=&page=&pageSize=` | List all orders |
| PATCH | `/api/admin/orders` | `{id, status, cancelReason?}` — override order status |
| GET | `/api/admin/pricing` | List all active pricing configurations |
| POST | `/api/admin/pricing` | `{serviceCategoryId, vehicleCategoryId?, regionId?, config}` — create new version |
| GET | `/api/admin/pricing/[id]` | Get version history for a config group |

## Geo

| Method | Endpoint | Body / Returns |
|---|---|---|
| GET | `/api/geo/search?q=` | `{results: Address[]}` — mocked address search |
| POST | `/api/geo/route` | `{from: LatLng, to: LatLng}` → `{polyline, distanceKm, durationMinutes, fromAddress, toAddress}` |

## Notifications

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/notifications` | List user's notifications (50 most recent) |
| PATCH | `/api/notifications` | `{id?, markAsRead: true}` — mark one or all as read |

## Error response format

All errors return JSON:

```json
{
  "error": "ERROR_CODE",
  "detail": "Optional human-readable detail",
  "status": 400
}
```

Common error codes:
- `UNAUTHORIZED` (401) — no session or session expired
- `FORBIDDEN` (403) — role not allowed, or object-level auth failed
- `NOT_FOUND` (404) — resource doesn't exist
- `MISSING_FIELDS` (400) — required fields missing from request body
- `INVALID_TRANSITION:from->to` (400) — state machine violation
- `INTERNAL_ERROR` (500) — unexpected server error (detail logged server-side)
