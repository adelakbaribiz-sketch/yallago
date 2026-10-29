# Changelog

All notable changes to YallaGo are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-10-29

### Added

- **Dark-mode-first UI** — premium charcoal palette with warm terracotta accent, verified against WCAG AA contrast.
- **Theme toggle** in every header (customer, driver, admin, auth screen) — users can switch to light mode if preferred.
- **Theme-aware map tiles** — Leaflet swaps between OpenStreetMap (light) and CARTO `dark_all` tiles (dark) based on `resolvedTheme`.
- **Dark-mode Leaflet styling** — popups, zoom controls, attribution, and map background all adapt to dark theme.
- **`docs/` folder** with eight documentation files: `ARCHITECTURE.md`, `DECISIONS.md`, `DATABASE_SCHEMA.md`, `API_REFERENCE.md`, `IMPLEMENTATION_PLAN.md`, `SECURITY.md`, `LIMITATIONS.md`, and this `CHANGELOG.md`.
- **12 dark-mode screenshots** in `docs/screenshots/` covering: login, customer home, customer booking with map + fare estimate, customer tracking, driver home with incoming request modal, driver active job, admin dashboard, admin drivers (with approve/reject), admin pricing editor, admin orders, cargo booking form.
- **Rewritten README** in the style of the [AI-NODE](https://github.com/adelakbaribiz-sketch/AI-NODE) reference: tagline, status notice, problem / solution / features sections, screenshots table, architecture diagram, tech stack, demo instructions, project structure, documentation index, business overview, limitations, portfolio case study, license, and about.
- **`ThemeProvider`** wrapping the app via `next-themes` with `defaultTheme="dark"`, `enableSystem={false}`.
- **Inline pre-hydration script** in `layout.tsx` that sets the `.dark` class on `<html>` before React mounts, preventing a flash of unstyled content (FOUC).

### Changed

- Dark theme tokens in `globals.css` refined: deeper charcoal background (`oklch(0.14 0.008 60)`), brighter terracotta primary (`oklch(0.68 0.20 32)`), warmer accent tint, and a 5-color chart palette tuned for dark surfaces.
- `MapView.tsx` now stores a `tileLayerRef` and swaps tile layers when the theme changes (instead of being hardcoded to OpenStreetMap).
- All three role-based apps (customer, driver, admin) and the auth screen now include a `ThemeToggle` button in their headers.

### Documentation

- `docs/DECISIONS.md` — rationale for dark-mode-first, modular monolith, Socket.io mini-service, Prisma + SQLite, versioned pricing, atomic dispatch, HTTP-only session cookies, provider-independent abstractions, shadcn/ui, and original brand identity.
- `docs/SECURITY.md` — threat model, what's implemented, known gaps, hardening checklist.
- `docs/LIMITATIONS.md` — candid list of what's NOT implemented, grouped by severity.
- `docs/API_REFERENCE.md` — all 30+ endpoints with request/response shapes and error codes.

## [0.1.0] — 2026-10-11

### Added

- **Initial release** of YallaGo — a ride-hailing and logistics platform demo.
- **Three service categories**: Car (4 vehicle types), Motorcycle (passenger + package delivery), Cargo (6 vehicle types with quotation workflow).
- **Three role-based applications** sharing one backend:
  - **Customer app** — service selection, address search, live map with route polyline, fare estimate, ride request, real-time tracking, trip history, 5-star ratings.
  - **Driver app** — registration with document upload, admin approval flow, online/offline toggle, incoming request modal, accept/reject with atomic concurrency guard, active trip state machine, earnings dashboard.
  - **Admin dashboard** — KPI dashboard, customer management, driver verification (approve/reject/suspend), order management with filters, cargo quotation approval, versioned pricing editor with audit trail.
- **Backend** — 30+ API endpoints under `/api/{auth,services,pricing,orders,drivers,admin,geo,notifications}/`.
- **Authentication** — PBKDF2 password hashing, HTTP-only session cookies, role-based access control, object-level authorization.
- **Atomic driver dispatch** — database transaction + conditional `updateMany` prevents duplicate assignment under concurrent accepts.
- **Versioned pricing engine** — every update creates a new version; old versions retain `effectiveTo` timestamp; historical orders reference their original `pricingConfigVersion`.
- **Order state machines** — service-specific lifecycles (ride, delivery, cargo) with server-side transition validation and full `OrderEvent` audit trail.
- **Financial ledger** — double-entry-style records (`CUSTOMER_CHARGE`, `DRIVER_CREDIT`, `PLATFORM_COMMISSION`) auto-created on order completion.
- **Real-time updates** — Socket.io mini-service on port 3003 with room-isolated driver location broadcasts.
- **Maps** — Leaflet + OpenStreetMap (no API key required); provider-independent geocoding/routing abstraction in `src/lib/geo.ts`.
- **Database** — Prisma + SQLite with 20+ models; PostgreSQL-ready schema.
- **Original brand identity** — "YallaGo" name, warm terracotta accent color, all UI copy original.
- **Demo credentials** seeded: customer, driver, admin, and a pending driver for testing the approval workflow.
- **Scripts**: `seed.ts`, `refresh-driver.ts`, `clean-tx.ts`.
- **Comprehensive README**, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `IMPLEMENTATION_PLAN.md`.

### Verified workflows

- Customer registration → login → order creation → driver accept → state machine → completion → rating → ledger entries → admin dashboard reflection.
- Concurrency test: two simultaneous accepts → only one wins, the other receives `ALREADY_ASSIGNED`.
- Concurrency test: two simultaneous accepts of the same order from different sessions → only one succeeds.
- Authorization test: customer cannot access another customer's order (403); unapproved driver cannot accept requests (403).

### Known limitations (carried forward)

See [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) for the full list. Highlights:
- No real payment processing (mock provider).
- No background job system (offer expiration uses client polling).
- No OTP / SMS verification.
- No native mobile apps (responsive PWA).
- No RTL / Persian localization.
- No automated test suite.
- No Docker / CI.
- SQLite (not PostgreSQL with PostGIS).
