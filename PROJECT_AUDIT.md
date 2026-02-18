# CarHop Project Audit & System Walkthrough

This document is a full-system orientation for CarHop so a new contributor can quickly understand how it works end to end.

## 1) Product and stack

CarHop is a peer-to-peer car rental marketplace with:
- **Frontend**: React + Vite SPA.
- **Backend**: FastAPI + SQLAlchemy.
- **Database**: PostgreSQL.
- **Containerization**: Docker Compose.

The API and DB are started by Compose, with backend code mounted for hot reload.

## 2) Runtime architecture

### Services
- `db`: PostgreSQL 16.
- `api`: FastAPI app served by Uvicorn with `--reload`.

The backend is configured using environment variables for DB URL, JWT, cookie policy, uploads storage, and SMTP email settings.

### HTTP topology
In local dev, frontend calls `/api/*` and backend serves:
- Business endpoints under `/auth`, `/profile`, `/cars`, `/bookings`.
- Uploaded files under `/uploads/*` (local filesystem-backed).
- Health endpoint at `/health`.

## 3) Authentication and session model

CarHop uses **cookie-based auth** with layered security:
1. Login sets an **access token cookie** + **refresh token cookie** + **csrf cookie**.
2. Access token authenticates requests.
3. State-changing requests require CSRF header matching CSRF cookie.
4. If an API call returns 401, frontend automatically calls `/auth/refresh`, then retries once.
5. Refresh tokens are persisted hashed in DB and rotated on refresh.

Important details:
- Only hash of refresh token is stored in DB.
- Refresh token rotation revokes old token row and creates a new row.
- Protected dependencies enforce authenticated user, and optionally verified email.

## 4) Authorization and role model

Roles are string-based (`USER` / `ADMIN`).

Current role checks:
- Admin-only endpoint to verify a user license.
- Car modification endpoints enforce owner-or-admin for updates/deletes/photos.
- Incoming booking decisions are restricted to listing owner.

## 5) Domain model and workflow

### Core entities
- **User**: identity, hashed password, verification flags, role, created_at.
- **DriverLicense**: one-per-user, verified by admin.
- **CarListing**: car metadata, owner, status, features JSON.
- **CarPhoto**: ordered photos with local storage key + URL.
- **BookingRequest**: renter-to-owner booking request with status lifecycle.
- **RefreshToken**: persisted hashed refresh sessions.
- **EmailVerificationToken**: one-time email verification token.

### Typical user journey
1. User registers (must be 21+).
2. User verifies email token.
3. User logs in (cookies issued).
4. User submits driver license; admin verifies it.
5. Verified user can request bookings.
6. Owner approves/rejects incoming requests.
7. Renter can cancel based on status/date rules.

## 6) Cars marketplace behavior

`GET /cars` supports:
- date range availability filtering against **APPROVED** bookings only.
- city partial match (`ilike`).
- price range, transmission, fuel type, min seats filters.

If date range is provided, listings overlapping approved bookings are excluded.

Additional behavior:
- Car cards include owner metadata enrichment (`member_since`, listing count) at query time.
- Max 8 photos per listing.
- MIME guard + extension normalization for local uploads.

## 7) Booking behavior and business rules

Booking request rules:
- requester must be authenticated + email verified + license verified.
- renter cannot book own car.
- dates must be valid.
- overlaps blocked only against APPROVED bookings.

Owner actions:
- approve only pending bookings and only if still no approved overlap.
- reject only pending bookings.

Renter cancellation:
- can cancel pending anytime.
- can cancel approved only before start date.

Email notifications are attempted on request/approve/reject/cancel but never block action success.

## 8) Frontend composition

`App.jsx` is the composition shell:
- restores session by fetching `/profile/me` on mount.
- computes gates (`canListCars`, `canBook`).
- renders navigation by auth/email/admin state.
- hosts page-level routing via local `active` state.

Page responsibilities:
- **AuthPage / VerifyEmailPage**: registration, login, token verification.
- **ProfilePage**: profile status + license submission + optional admin verify.
- **MarketplacePage**: search/filter and booking requests.
- **ListCarPage**: create listing + upload photos.
- **MyListingsPage**: owner CRUD + photo management.
- **IncomingBookingsPage**: owner decisions.
- **MyBookingsPage**: renter booking history + cancel actions.
- **AdminPage**: direct license verification utility.

## 9) Data and migration posture

Alembic migrations exist for baseline schema plus iterative changes (user defaults, listing expansion, car photos, created_at, etc.). This indicates schema is evolving, but migration discipline is in place.

## 10) Operational/security observations

### Strengths
- Cookie auth with refresh rotation + CSRF defense.
- Server-side overlap validation for booking integrity.
- Guarded owner/admin permissions for listing edits.
- Non-blocking email dispatch to keep core flows robust.

### Risks / improvement opportunities
1. **Secrets committed in Compose** (SMTP credentials visible). Move all secrets to `.env`/secret manager immediately.
2. CORS origins are hardcoded in app startup; align with env-driven config for multi-env deploys.
3. Payments are currently simulated (no real processor/webhooks yet); move to Stripe (or equivalent) before production.
4. Booking status is stringly-typed; introducing enum constraints can reduce data drift.
5. Consider explicit rate limiting + auth brute-force mitigation for login/verify endpoints.

## 11) Quick mental model for contributors

If you want to debug any feature fast:
1. Start with frontend page in `frontend/src/pages/*`.
2. Trace API call in `frontend/src/lib/api.js`.
3. Open corresponding backend router in `backend/app/routers/*`.
4. Follow model constraints in `backend/app/models/*`.
5. Confirm migration/state assumptions in `backend/alembic/versions/*`.

This project is already in a good “MVP-plus” state: the foundations for auth, listing CRUD, and booking lifecycle are solid, with clear next steps toward production readiness (payments, messaging, reviews, stronger secret management, and deploy hardening).

## 12) Prioritized roadmap to final version

1. **Product-complete trust features**
- Add payments/escrow flow.
- Add in-app messaging between renter and owner.
- Add reviews/ratings after completed bookings.
- Add dispute/cancellation policy flows in product logic.

2. **UI + feature polish for production readiness**
- Unify design system tokens, spacing, and typography across pages.
- Improve empty/loading/error states for all major flows.
- Polish booking/listing UX (filter clarity, card hierarchy, confirmations).
- Improve mobile responsiveness and accessibility pass (keyboard/contrast/forms).

3. **Reliable deploy path**
- Create production compose/deploy profile.
- Ensure Alembic migrations run in release pipeline/startup.
- Add health checks/readiness checks and startup ordering.
- Document one-command deploy and rollback procedure.

4. **Security baseline**
- Remove committed secrets from repository and rotate exposed credentials.
- Move environment config to secure secret management.
- Enforce production CORS/cookie settings by environment.
- Add auth endpoint rate limiting and brute-force protection.

5. **Test coverage**
- Keep smoke tests for publish listing and photo upload.
- Add booking lifecycle integration tests.
- Add auth/session/CSRF failure-path tests.
- Add CI gate for backend tests before merge/deploy.

6. **Ops and compliance**
- Add structured logging, error tracking, and basic metrics.
- Define DB/uploads backup and restore drills.
- Add admin/audit trails for high-risk actions.
- Prepare core legal docs (Terms, Privacy, cancellation policy) and data retention policy.

## 13) Current build status (handoff snapshot)

Date: 2026-02-18

### Completed in current development cycle

1. **Listing publish flow stabilized**
- Backend create listing + photo upload is working.
- Smoke test added for publish flow:
  - `backend/tests/test_publish_listing_smoke.py`

2. **Trust feature: reviews/ratings**
- Renter can leave one review per completed approved booking.
- Owner rating metadata is surfaced in marketplace cards.
- Backend additions:
  - `backend/app/models/review.py`
  - `backend/app/schemas/review.py`
  - `backend/app/routers/reviews.py`
  - `backend/alembic/versions/8a1d2f4c9b01_create_reviews_table.py`

3. **Trust feature: renter-owner booking messaging**
- Booking thread messages between renter and owner.
- Participant-only access control enforced server-side.
- Backend additions:
  - `backend/app/models/message.py`
  - `backend/app/schemas/message.py`
  - `backend/app/routers/messages.py`
  - `backend/alembic/versions/bf2c7a11d932_create_messages_table.py`
- Frontend wiring:
  - `frontend/src/pages/MyBookingsPage.jsx`
  - `frontend/src/pages/IncomingBookingsPage.jsx`

4. **Trust feature: disputes flow**
- Renter/owner can open dispute for non-pending bookings.
- Admin can list open disputes and resolve/reject with a note.
- Backend additions:
  - `backend/app/models/dispute.py`
  - `backend/app/schemas/dispute.py`
  - `backend/app/routers/disputes.py`
  - `backend/alembic/versions/c3d8e21aa7f0_create_disputes_table.py`
- Frontend wiring:
  - `frontend/src/pages/MyBookingsPage.jsx`
  - `frontend/src/pages/IncomingBookingsPage.jsx`
  - `frontend/src/pages/AdminPage.jsx`

5. **Payments/escrow flow (simulated provider)**
- Renter can pay approved bookings into escrow.
- Owner/admin can release escrow only after booking end date.
- Admin can refund paid/released bookings.
- Release/payment is blocked when an open dispute exists.
- Backend additions:
  - `backend/app/models/payment.py`
  - `backend/app/schemas/payment.py`
  - `backend/app/routers/payments.py`
  - `backend/alembic/versions/f4a7d2c6b1e0_create_payments_table.py`
- Frontend wiring:
  - `frontend/src/pages/MyBookingsPage.jsx`
  - `frontend/src/pages/IncomingBookingsPage.jsx`

### Router/model wiring completed
- `backend/app/main.py` includes routers for reviews, messages, disputes, and payments.
- `backend/app/models/__init__.py` includes `Review`, `Message`, `Dispute`, and `Payment`.

### Test status
- Container smoke suite passing:
  - `backend/tests/test_publish_listing_smoke.py`
  - `backend/tests/test_booking_messages_smoke.py`
  - `backend/tests/test_dispute_smoke.py`
  - `backend/tests/test_payment_escrow_smoke.py`
- Last known result: `4 passed`.

### Required migration command when pulling this state
Run after starting API container:

```bash
docker compose exec api alembic upgrade head
```

### Current roadmap progress (from Section 12)
1. Product-complete trust features:
- Reviews/ratings: done
- Messaging: done
- Disputes: done
- Payments/escrow (simulated): done
- Real processor integration (Stripe + webhooks): **next major item**

2. UI + feature polish for production readiness:
- Partially improved in booking pages (messaging/dispute UI)
- Full polish pass still pending

3. Reliable deploy path: pending
4. Security baseline: pending
5. Test coverage: in progress (smoke coverage added, broader integration suite pending)
6. Ops and compliance: pending

### Recommended next implementation step
- Integrate Stripe test mode as payment source of truth:
  - create PaymentIntent/Checkout session
  - consume webhook events for paid/refunded transitions
  - reconcile webhook state with escrow release/refund rules
