# CarHop Project Audit (Updated)

Date: 2026-02-18

## 1) Executive Summary

CarHop is now in a strong MVP-plus state with:
- Full renter/owner lifecycle: auth, profile/license, listing CRUD, booking, messaging, reviews, disputes.
- Escrow payments implemented with two paths:
  - Stripe test mode (Checkout + webhook source of truth + Connect payout path).
  - Simulated fallback mode when Stripe keys are not configured.
- Professionalized frontend pass completed (design system, state components, modal-based dispute flows).
- Automated quality gates in place for backend, frontend unit tests, and frontend E2E.

## 2) Current Architecture

### Backend
- Framework: FastAPI + SQLAlchemy + Alembic
- Entry point: `backend/app/main.py`
- Routers mounted:
  - `auth`, `profile`, `cars`, `bookings`, `reviews`, `messages`, `disputes`, `payments`
- Health endpoint: `GET /health`
- Static uploads mount: `/uploads`

### Frontend
- React + Vite SPA
- Main shell: `frontend/src/App.jsx`
- API client with cookie auth + CSRF + refresh-retry: `frontend/src/lib/api.js`

### Data
- Primary runtime DB: PostgreSQL (docker-compose)
- Migrations: Alembic (`backend/alembic`)

## 3) Implemented Product Scope

### Identity, Auth, Session Security
- Registration with age gate (21+).
- Email verification token flow.
- Login sets access/refresh/csrf cookies.
- Refresh token rotation and revocation.
- CSRF protection on state-changing endpoints.
- Rate limiting on auth endpoints (register/login/verify/refresh).

### Profiles and Trust
- License submission flow for users.
- Admin-only license verification endpoint.
- Role model: `USER` and `ADMIN`.

### Cars and Listings
- Listing create, patch, detail, and listing photos upload/delete.
- Marketplace filtering by date availability, city, price, transmission, fuel type, seats.
- Owner metadata on listings (member since, listing count, review aggregates).
- Photo constraints and local storage support.
- Soft delete implemented:
  - If bookings exist, listing is archived (`status = ARCHIVED`) instead of hard delete.
  - Hard delete only when no bookings reference the car.

### Bookings
- Renter booking requests.
- Owner approve/reject incoming requests.
- Renter cancel logic by status/date rules.
- Overlap prevention against approved bookings.

### Messaging
- Booking-scoped renter-owner messaging thread.
- Participant-only access enforced server-side.

### Reviews
- One review per booking.
- Allowed only for approved bookings after booking end date.

### Disputes
- Renter or owner can open dispute for a booking (not pending).
- Admin can list open disputes and resolve/reject with note.
- Frontend now uses dedicated dispute modals (no `window.prompt`).

### Payments / Escrow / Stripe
- Payment domain implemented in `backend/app/routers/payments.py`.
- Renter can fund escrow for approved booking.
- Stripe mode:
  - Checkout Session creation.
  - Webhook handler updates payment lifecycle (idempotent event persistence).
  - Reconciliation endpoint for pending sessions.
  - Release to owner via Stripe transfer (requires connected/onboarded owner account).
  - Admin refund path via Stripe refund API.
- Simulated mode:
  - Immediate escrow funding without Stripe checkout.
- Business guards:
  - Open disputes block payment/release.
  - Release only after booking end date.

## 4) Frontend Status

A full UI polish pass has been applied:
- New visual system and typography in:
  - `frontend/src/App.css`
  - `frontend/src/index.css`
- Reusable state notice component:
  - `frontend/src/components/ui/StateNotice.jsx`
- Modalized disputes:
  - `frontend/src/components/disputes/DisputeCreateModal.jsx`
  - `frontend/src/components/disputes/DisputeResolveModal.jsx`
- Updated and cleaned pages:
  - `AuthPage`, `ListCarPage`, `MyListingsPage`, `MarketplacePage`, `MyBookingsPage`, `IncomingBookingsPage`, `AdminPage`
- Encoding/UX cleanup completed on key components (`Button`, `Modal`, `Toast`, `EditListingModal`).

## 5) Tests and Quality Coverage

### Backend Tests (pytest)
Current smoke/integration-style coverage includes:
- `test_publish_listing_smoke.py`
- `test_booking_messages_smoke.py`
- `test_dispute_smoke.py`
- `test_payment_escrow_smoke.py`
- `test_soft_delete_car_smoke.py`
- `test_stripe_webhook_smoke.py`
- `test_stripe_connect_onboarding_smoke.py`
- `test_stripe_release_requires_connected_owner.py`
- `test_stripe_ops_hardening_smoke.py`

### Frontend Unit Tests (Vitest)
- `AuthPage.test.jsx`
- `MarketplacePage.test.jsx`
- `DisputeCreateModal.test.jsx`

### Frontend E2E (Playwright)
- `frontend/e2e/journeys.spec.js`
- Multi-user journeys covered:
  - Booking request + owner approval
  - Dispute open + owner visibility
  - Escrow payment + release (handles simulated and Stripe-pending behavior)

## 6) CI/CD Status (GitHub Actions)

### Frontend workflow
- File: `.github/workflows/frontend-ci.yml`
- Jobs:
  - `vitest`: frontend unit tests
  - `playwright-e2e`: Postgres service + backend migration/start + frontend start + E2E run
- Artifacts uploaded on run: Playwright report/results and service logs.

### Backend workflow
- File: `.github/workflows/backend-ci.yml`
- Job:
  - `pytest`: installs backend dependencies and runs backend test suite.

## 7) Operational Notes

- Local dev orchestration remains in `docker-compose.yml` with `db` + `api` services.
- Frontend runs separately via Vite and proxies `/api` to backend.
- Stripe credentials are environment-driven; if absent, payment falls back to simulation mode.

## 8) Known Gaps / Remaining Work

1. Backend tests currently rely on in-memory SQLite fixtures; add a Postgres-backed integration suite for closer production parity.
2. Expand E2E coverage for admin-only flows (license verification, dispute resolution by admin, refund/reconcile flows).
3. Production hardening still needed:
- central secret management and rotation policy,
- stricter production CORS/cookie configuration matrix,
- monitoring/alerting and structured audit logs.
4. Compliance/ops docs (Terms/Privacy, retention, incident response, backup/restore drills) are still pending.

## 9) Recommended Next Priority

If the goal is production-readiness, the best next track is:
1. Add Postgres-backed backend integration tests in CI.
2. Add admin payment/dispute E2E flows.
3. Add deploy workflow + environment promotion strategy (staging -> production).

