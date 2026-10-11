# Database Schema

The platform uses Prisma + SQLite for development. Production should use PostgreSQL with PostGIS for geographic indexing.

## Models Overview

### Authentication

- **User** — Base account with role (CUSTOMER/DRIVER/ADMIN), status (ACTIVE/SUSPENDED/DELETED), email, phone, passwordHash, fullName, preferredLanguage
- **Session** — Signed session tokens (HTTP-only cookie), 7-day expiry, stored in DB for revocation
- **AdminProfile** — Admin role (SUPER_ADMIN/OPERATIONS_MANAGER/etc.) + permissions JSON
- **CustomerProfile** — Saved addresses JSON

### Drivers & Vehicles

- **Driver** — License info, status (PENDING/APPROVED/REJECTED/SUSPENDED), rating, totalCompleted, eligibleServiceCategories JSON, operatingRegion
- **Vehicle** — Driver-owned, plate, make/model/year, capacity, serviceCategoryId, registration, insurance, status (PENDING/APPROVED/REJECTED)
- **DriverLocation** — Latest GPS ping per driver (latitude, longitude, heading, speed, isOnline, lastSeenAt)

### Service Catalog

- **ServiceCategory** — Car/Motorcycle/Cargo config with supportsPassenger, supportsDelivery, requiresQuotation flags
- **VehicleCategory** — Service-specific vehicle types (Standard, Premium, SUV, Bike, Small Pickup, etc.) with capacity and baseFareMultiplier
- **ServiceRegion** — Geographic regions with country/city/currency/timezone, enabledServiceCategories JSON, boundaryJson (GeoJSON polygon)

### Pricing

- **PricingConfiguration** — Versioned JSON config per (serviceCategoryId, vehicleCategoryId, regionId). Each update creates a new version; old versions retain `effectiveTo` timestamp. Config JSON contains: baseFare, minFare, perKm, perMinute, bookingFee, cancellationFee, waitingFeePerMin, commissionRate, plus optional service-specific fields (helperFeePerHour, loadingFee, weightSurchargePerKg, etc.)

### Orders (Unified)

- **Order** — Single table for rides, deliveries, and cargo orders. Key fields:
  - serviceType: RIDE | MOTORCYCLE_RIDE | PACKAGE_DELIVERY | CARGO
  - status: REQUESTED | SEARCHING | DRIVER_ASSIGNED | DRIVER_ARRIVING | DRIVER_ARRIVED | IN_PROGRESS | LOADING | IN_TRANSIT | UNLOADING | COMPLETED | CANCELLED_BY_CUSTOMER | CANCELLED_BY_DRIVER | CANCELLED_BY_SYSTEM | NO_DRIVER_AVAILABLE | EXPIRED | QUOTATION_REQUESTED | QUOTATION_APPROVED | DELIVERY_FAILED
  - pickupLat/Lng/Address, destinationLat/Lng/Address
  - detailsJson — service-specific payload (package info, cargo info, etc.)
  - estimatedFare, finalFare, currency, distanceKm, durationMinutes, pricingConfigVersion
  - paymentMethod (CASH/CARD/WALLET/INVOICE), paymentStatus
  - quotationStatus, quotationAmount, quotationApprovedById/At
  - deliveryConfirmCode, deliveredAt
  - State machine timestamps: requestedAt, assignedAt, driverArrivedAt, startedAt, completedAt, cancelledAt
  - cancelReason, cancelledBy

- **OrderEvent** — Auditable transition history per order (eventType, fromStatus, toStatus, actorId, actorType, metadataJson)

- **DriverAssignment** — Tracks offers to drivers per order (OFFERED → ACCEPTED/REJECTED/EXPIRED/CANCELLED). Unique constraint on (orderId, status) prevents duplicate active offers.

### Payments & Ledger

- **Payment** — Payment records with provider (MOCK/STRIPE/PAYPAL/LOCAL_GATEWAY), method, amount, status (PENDING/AUTHORIZED/CAPTURED/FAILED/REFUNDED/PARTIALLY_REFUNDED), failureReason, refundAmount
- **LedgerEntry** — Double-entry-style financial records with transactionRef (unique), entryType (CUSTOMER_CHARGE/DRIVER_CREDIT/DRIVER_DEBIT/PLATFORM_COMMISSION/REFUND/ADJUSTMENT/PAYOUT/PAYOUT_REVERSAL), amount (signed), referenceType/Id
- **Payout** — Driver payout batches with periodStart/End, status (PENDING/PROCESSING/COMPLETED/FAILED)

### Ratings

- **Rating** — 5-star ratings per order, with raterId, rateeId, rateeRole (CUSTOMER/DRIVER), comment, tagsJson. Unique constraint on (orderId, raterId) prevents duplicate ratings.

### Notifications

- **Notification** — In-app/push/SMS/email queue with type, title, body, dataJson, channel (IN_APP/PUSH/SMS/EMAIL), status (PENDING/DELIVERED/FAILED/READ), readAt

### Support

- **SupportTicket** — Tickets with code, requester, assignee, orderId, category, priority (LOW/NORMAL/HIGH/URGENT), status (OPEN/IN_PROGRESS/WAITING_CUSTOMER/RESOLVED/CLOSED/ESCALATED), messagesJson (conversation history), resolutionNotes

### Audit

- **AuditLog** — Admin action audit trail with actorId, actorType, action, resourceType, resourceId, metadataJson, ipAddress

## Indexes

- `DriverLocation(driverId, isOnline, lastSeenAt)` — for dispatch queries
- `Order(status, serviceCategoryId)` — for dashboard counts
- `Order(customerId, createdAt)` — for customer history
- `Order(driverId, status)` — for driver active jobs
- `OrderEvent(orderId, createdAt)` — for event history
- `DriverAssignment(driverId, status)` — for driver requests
- `LedgerEntry(orderId)` — for order ledger lookup
- `LedgerEntry(userId, createdAt)` — for user earnings/balance queries
- `Notification(userId, status, createdAt)` — for unread notification counts
- `AuditLog(actorId, createdAt)` — for actor activity
- `AuditLog(action, createdAt)` — for action filtering
- `PricingConfiguration(serviceCategoryId, isActive, effectiveFrom)` — for active config lookup

## Constraints

- Unique email per user
- Unique phone per user (when set)
- Unique session token
- Unique order code (e.g., `ORD-ABC12`)
- Unique (serviceCategoryId, code) on VehicleCategory
- Unique (orderId, raterId) on Rating — prevents duplicate ratings
- Unique (orderId, status) on DriverAssignment — prevents duplicate active offers
- Unique transactionRef on LedgerEntry
- Unique code on SupportTicket

## Foreign Keys

All FK relations use `onDelete: Cascade` where the parent is a user/order/etc. (deleting a user deletes their sessions, notifications, etc.). For audit logs and ledger entries, the actor/user reference is optional to allow system-generated events.

## Migration Strategy

Currently using `prisma db push` for development (auto-syncs schema). For production:
1. Switch to `prisma migrate dev` for generating migration files
2. Review each migration before applying
3. Test migrations on staging before production
4. Always backup before migration
