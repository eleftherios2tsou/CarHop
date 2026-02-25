# CarHop — Project Audit

**Module:** Web Application Development
**Institution:** University of the West of England (UWE Bristol)
**Last updated:** February 2026 (all sprint features complete — Weeks 1–5)

---

## 1. Project Overview

CarHop is a peer-to-peer car rental marketplace web application. Verified users can list their own vehicles for rent, and other verified users can browse and book those vehicles. The platform handles the full rental lifecycle: listing, booking, payment escrow, messaging, reviews, and dispute resolution.

---

## 2. Technology Stack

### Backend
| Component | Technology |
|---|---|
| Framework | FastAPI 0.115.0 (Python 3.11) |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 with Alembic migrations |
| Authentication | JWT (python-jose) + bcrypt password hashing |
| Payments | Stripe (Connect + PaymentIntents) |
| Email | Python `smtplib` (SMTP/TLS) — Gmail SMTP in production |
| Image processing | Pillow 10.4, OpenCV 4.10 (headless) |
| Cloud storage | Azure Blob Storage (`azure-storage-blob 12.24.0`) |
| AI search | OpenAI GPT-4o-mini (optional, via `OPENAI_API_KEY`) |
| Containerisation | Docker + Docker Compose |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 19.2 + Vite |
| Styling | Custom CSS (design tokens, CSS variables) |
| HTTP client | Native `fetch` with custom `apiFetch` / `apiFetchForm` wrappers |
| Testing | Vitest + Playwright (E2E) |

---

## 3. Architecture

```
┌──────────────────────────────────────────────────┐
│  Browser (React SPA — Vite dev server :5173)     │
│  Single-page app, no client-side router.         │
│  Active "tab" state drives which page renders.   │
└──────────────────┬───────────────────────────────┘
                   │  HTTP + Cookie auth
                   ▼
┌──────────────────────────────────────────────────┐
│  FastAPI  :8000                                  │
│  /api/*   — REST endpoints (JSON)                │
│  /uploads — Static file serving (local mode)     │
└────────────┬─────────────────┬───────────────────┘
             │                 │
             ▼                 ▼
    PostgreSQL :5432      Gmail SMTP
    (carhop DB)           (email verification)
             │
             ▼
    Azure Blob Storage
    (STORAGE_BACKEND=azure)
    OR local disk (default)
```

### Key architectural decisions
- **Cookie-based sessions** (httpOnly, SameSite=Lax) rather than localStorage tokens — prevents XSS token theft.
- **CSRF double-submit pattern** — unsafe HTTP methods require an `X-CSRF-Token` header matching a cookie value.
- **Refresh token rotation** — each refresh invalidates the old token and issues a new one; stored hashed in the DB.
- **Background tasks** — licence verification runs as an async FastAPI `BackgroundTask` so the upload endpoint returns immediately while processing continues server-side.
- **Unified storage abstraction** — `services/storage.py` switches between local disk and Azure Blob Storage via a single env var (`STORAGE_BACKEND`).

---

## 4. Database Schema

### Tables

| Table | Purpose |
|---|---|
| `users` | Core identity — email, password hash, name, DOB, role, Stripe account, avatar, bio |
| `email_verification_tokens` | UUID token issued on registration, deleted on verify |
| `refresh_tokens` | Hashed refresh tokens with expiry and revocation flag |
| `driver_licenses` | Licence details + photo storage paths + verification status |
| `cars` | Car listings with all rental attributes |
| `car_photos` | Up to 8 photos per car (local or Azure Blob storage) |
| `bookings` | Booking requests with status state machine |
| `payments` | Stripe PaymentIntent + charge/transfer/refund IDs + deposit fields |
| `messages` | Per-booking message thread |
| `reviews` | Post-rental reviews by renters |
| `disputes` | Dispute records linked to bookings |
| `damage_reports` | Post-trip damage reports filed by owners; admin-resolved with deposit decision |
| `availability_blocks` | Owner-created date blocks that prevent marketplace bookings for a car |
| `stripe_webhook_events` | Idempotency log for processed Stripe webhooks |

### Notable column additions (migrations)

| Migration | Table | Columns added |
|---|---|---|
| `e4b3a2c1d0f9` | `users` | `avatar_key`, `avatar_url`, `bio` |
| `f5c6d7e8a9b0` | `payments` | `deposit_amount_pence` (int, default 25000), `deposit_status` (HELD/RELEASED/FORFEITED), `deposit_released_at` |
| `g6d7e8f9a0b1` | — | Creates `damage_reports` table |
| `h7e8f9a0b1c2` | `reviews` | `review_type` (CAR_REVIEW/RENTER_REVIEW), `target_user_id` |
| `i8f9a0b1c2d3` | — | Creates `availability_blocks` table |
| `j9a0b1c2d3e4` | `cars` | `cancellation_policy`, `instant_book_enabled` |
| `j9a0b1c2d3e4` | `payments` | `refund_amount_pence`, `cancellation_policy_applied` |
| `k0b1c2d3e4f5` | `users` | `terms_accepted_at`, `gdpr_erasure_requested_at` |

### Driver licence verification states

```
pending  →  processing  →  approved
                       ↘  manual_review  (admin can approve / reject)
                       ↘  rejected       (rejection reason stored)
```

---

## 5. Feature Inventory

### Authentication & Identity
- [x] Email/password registration with age gate (21+), bcrypt 72-byte limit enforced
- [x] Real email verification via Gmail SMTP — one-click link (`?verify=<token>`)
- [x] JWT access tokens (15 min) + rotating refresh tokens (30 days)
- [x] CSRF protection on all state-changing endpoints
- [x] Rate limiting on auth endpoints (per-IP, sliding window)
- [x] Role-based access control (`USER` / `ADMIN`)

### Licence Verification Pipeline
- [x] User uploads **driving licence photo** + **selfie** (multipart form)
- [x] Images saved to Azure Blob Storage (or local disk in dev)
- [x] **Pillow** quality checks: minimum resolution (200×100 px), not blank, not too dark
- [x] **Pillow** orientation check: licence must be landscape (card-shaped)
- [x] **OpenCV Haar cascade** face detection: selfie must contain a human face
- [x] All checks run as an async background task (~3 s processing delay)
- [x] Status transitions: `pending → processing → approved / rejected / manual_review`
- [x] Admin can manually approve or reject with a reason
- [x] Frontend polls every 3 s while `status === "processing"` and auto-updates UI

### Car Listings
- [x] Create / update / delete car listings
- [x] Up to 8 photos per car stored in Azure Blob Storage (or local disk)
- [x] Fields: make, model, year, city, price/day, transmission, fuel type, seats, description
- [x] Date-range availability filtering in marketplace search
- [x] Pagination (20 cars per page)
- [x] AI-powered natural language search (OpenAI GPT-4o-mini, optional)

### Booking Flow
- [x] Renters submit booking requests with date range
- [x] Safety info modal — renters must acknowledge insurance/deposit/condition-photo terms before confirming *(13.1)*
- [x] Owners approve or reject incoming bookings
- [x] Booking status state machine: `pending → approved / rejected / cancelled / completed`

### Payments (Stripe)
- [x] Stripe PaymentIntents — card charge on booking approval
- [x] Stripe Connect — owners connect a payout account (Express)
- [x] Escrow model — funds held until rental completes, then transferred to owner
- [x] **£250 refundable security deposit** — added as a second Stripe line item (or simulated); held as `HELD`, set to `RELEASED` on escrow release, or `FORFEITED` by admin after a damage report *(13.3)*
- [x] Escrow release blocked while any open damage report or dispute exists *(13.3)*
- [x] Refund support via `stripe_refund_id`
- [x] Webhook idempotency — duplicate Stripe events silently ignored

### Messaging & Reviews
- [x] Per-booking message thread between owner and renter
- [x] Post-rental reviews by renters (1–5 stars + comment)

### Two-Way Reviews *(13.4)*
- [x] `review_type` column on reviews (`CAR_REVIEW` | `RENTER_REVIEW`); `target_user_id` FK for renter reviews
- [x] Migration `h7e8f9a0b1c2` adds columns
- [x] `POST /reviews/{booking_id}/renter` — owner-only, post-trip, one per booking
- [x] `GET /reviews/user/{user_id}` — aggregate renter rating + individual review list
- [x] Incoming Bookings — "Review Renter" inline form on COMPLETED bookings

### Availability Calendar *(13.5)*
- [x] `AvailabilityBlock` model (`availability_blocks` table) — car_id, start_date, end_date, reason; migration `i8f9a0b1c2d3`
- [x] `GET /cars/{id}/availability`, `POST /cars/{id}/availability/block`, `DELETE /cars/{id}/availability/blocks/{block_id}`
- [x] Marketplace filter excludes cars with overlapping availability blocks (EXISTS subquery)
- [x] Booking request blocked if dates overlap an availability block (409 Conflict)
- [x] My Listings — expandable availability panel per car with add/remove block UI

### Cancellation Policies *(13.6)*
- [x] `cancellation_policy` (`FLEXIBLE` | `MODERATE` | `STRICT`, default `FLEXIBLE`) on `CarListing`; migration `j9a0b1c2d3e4`
- [x] Cancel endpoint computes refund % from policy + hours-until-start; stores `refund_amount_pence` + `cancellation_policy_applied` on `Payment`
- [x] My Bookings — confirm dialog shows calculated refund label before cancelling an APPROVED booking
- [x] Marketplace car card shows policy label; Edit Listing modal has policy selector dropdown

### Instant Book *(13.7)*
- [x] `instant_book_enabled` (bool, default `False`) on `CarListing`; migration `j9a0b1c2d3e4`
- [x] `PATCH /cars/{id}/instant-book` — owner toggle; validates ≥5 `CAR_REVIEW`s with average ≥4.5★ server-side
- [x] Booking creation auto-approves if `instant_book_enabled` and owner still qualifies at request time
- [x] Marketplace — "⚡ Instant" badge on qualifying cars; My Listings — Instant Book checkbox with eligibility note

### GDPR Compliance *(13.9)*
- [x] Cookie consent banner (`CookieConsentBanner.jsx`) — `localStorage`-persisted; links to Privacy Policy tab
- [x] `GET /profile/export` — JSON dump of profile, bookings, and payments (GDPR right of access)
- [x] `DELETE /profile/me` — anonymises PII in-place, disconnects Stripe Connect, deletes blobs, clears session cookies (CSRF-protected)
- [x] `terms_accepted_at` and `gdpr_erasure_requested_at` columns on `User`; migration `k0b1c2d3e4f5`
- [x] ProfilePage — "Export My Data" download button + Danger Zone delete with confirmation dialog

### Terms & Privacy Pages *(13.10)*
- [x] `TermsPage.jsx` — static Terms of Service (7 sections: intro, eligibility, responsibilities, payments, cancellation, liability, governing law)
- [x] `PrivacyPage.jsx` — static Privacy Policy (6 sections: data collected, use, cookies, sharing, retention/erasure, contact)
- [x] Both pages always visible in nav dropdown; footer links on every page
- [x] Registration T&C checkbox required to enable submit button; `terms_accepted_at` timestamp stored at registration

### Disputes
- [x] Dispute records linked to bookings with admin resolution

### Damage Reports *(13.2)*
- [x] Owners can file a post-trip damage report on completed bookings (description, optional cost estimate, up to 5 photos)
- [x] One report per booking (unique constraint)
- [x] Status machine: `OPEN → UNDER_REVIEW → RESOLVED / DISMISSED`
- [x] Admin resolves report + sets deposit decision (release to renter or forfeit to owner)
- [x] Deposit status updated on resolution; escrow release blocked while report is OPEN/UNDER_REVIEW

### User Profiles & Avatars *(13.8)*
- [x] Avatar upload — stored via unified storage abstraction; old blob deleted on replace
- [x] Bio field (max 500 chars) — editable from profile page
- [x] Public profile endpoint (`GET /profile/user/{id}`) — name, avatar, bio, member since
- [x] `ProfilePage` — circular avatar widget with initials fallback + bio editor with character counter

### Cloud Storage
- [x] Azure Blob Storage integration (`azure-storage-blob`)
- [x] Unified `storage.py` abstraction — local or Azure via env var
- [x] All car photos, licence images, avatars, and damage report photos routed through the abstraction layer

### Information Page
- [x] Dedicated `/Information` page — always visible, no auth required
- [x] Covers: insurance requirements, condition photos, £250 deposit, booking process steps, eligibility rules

### Admin
- [x] Admin dashboard for licence approval / rejection
- [x] Dispute management
- [x] **Damage report management** — list all reports; resolve with deposit decision *(13.2)*
- [x] Role guard: admin-only endpoints return 403 to regular users

---

## 6. API Endpoints

### Auth — `/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register; sends verification email via Gmail SMTP |
| POST | `/auth/verify-email/{token}` | Verify email with UUID token |
| POST | `/auth/login` | Login; sets httpOnly auth cookies |
| POST | `/auth/refresh` | Rotate refresh token; mint new access token |
| POST | `/auth/logout` | Revoke refresh token; clear cookies |

### Profile — `/profile`
| Method | Path | Description |
|---|---|---|
| GET | `/profile/me` | Get full profile including licence status, avatar, bio |
| PATCH | `/profile/me` | Update bio (JSON body) |
| POST | `/profile/avatar` | Upload/replace avatar image (multipart) |
| GET | `/profile/user/{user_id}` | Public profile: name, avatar, bio, member since |
| POST | `/profile/license` | Submit licence photos + details (multipart) |
| POST | `/profile/license/{user_id}/verify` | Admin: approve licence |
| POST | `/profile/license/{user_id}/reject` | Admin: reject licence with reason |
| POST | `/profile/payout/onboard` | Start Stripe Connect Express onboarding |
| POST | `/profile/payout/refresh` | Sync Stripe Connect payout status |
| GET | `/profile/export` | GDPR: download personal data as JSON |
| DELETE | `/profile/me` | GDPR: anonymise account and clear session (CSRF) |

### Cars — `/cars`
| Method | Path | Description |
|---|---|---|
| GET | `/cars/` | Paginated marketplace listings with filters |
| POST | `/cars/` | Create listing |
| GET | `/cars/{id}` | Car detail |
| PATCH | `/cars/{id}` | Update listing |
| DELETE | `/cars/{id}` | Delete listing (soft if bookings exist) |
| POST | `/cars/{id}/photos` | Upload photos (multipart, max 8) |
| DELETE | `/cars/{id}/photos/{photo_id}` | Delete a photo |
| GET | `/cars/{id}/availability` | List blocked date ranges for a car |
| POST | `/cars/{id}/availability/block` | Owner: add a date block (CSRF) |
| DELETE | `/cars/{id}/availability/blocks/{block_id}` | Owner: remove a date block (CSRF) |
| PATCH | `/cars/{id}/instant-book` | Owner: toggle Instant Book; validates qualification (CSRF) |

### Reviews — `/reviews`
| Method | Path | Description |
|---|---|---|
| POST | `/reviews/{booking_id}/car` | Renter: review the car (post-trip, one per booking) |
| POST | `/reviews/{booking_id}/renter` | Owner: review the renter (post-trip, one per booking) |
| GET | `/reviews/user/{user_id}` | Public: aggregate renter rating + list of renter reviews |

### Search — `/search`
| Method | Path | Description |
|---|---|---|
| POST | `/search/parse` | Parse natural language query into structured filters (OpenAI) |

### Damage Reports — `/damage-reports`
| Method | Path | Description |
|---|---|---|
| POST | `/damage-reports/booking/{booking_id}` | Owner: file a damage report (multipart — description, cost, up to 5 photos) |
| GET | `/damage-reports/booking/{booking_id}` | Owner / renter / admin: get report for a booking |
| GET | `/damage-reports/` | Admin: list all reports (optional `?status=OPEN`) |
| POST | `/damage-reports/{id}/resolve` | Admin: resolve with status + deposit decision |

### Other
Standard CRUD endpoints under `/bookings`, `/messages`, `/reviews`, `/disputes`, `/payments`.

---

## 7. Security Implementation

| Concern | Approach |
|---|---|
| Password storage | bcrypt (cost factor 12), 72-byte input cap |
| Session tokens | httpOnly + Secure cookies, short-lived JWTs |
| CSRF | Double-submit cookie pattern (`X-CSRF-Token` header) |
| Token refresh | Rotation with DB revocation — replay triggers revoke |
| Rate limiting | In-memory sliding window per IP on all auth routes |
| File uploads | MIME type + extension whitelist; UUID-randomised filenames |
| SQL injection | Parameterised queries via SQLAlchemy ORM throughout |
| Role enforcement | Checked server-side on every admin endpoint |
| Secrets | All credentials in `.env` (gitignored); never in source code |

---

## 8. Licence Verification — Technical Detail

The pipeline (`backend/app/services/verification.py`) runs four checks in sequence. The first failure short-circuits the rest and stores a human-readable rejection reason.

```
Upload (multipart: licence photo + selfie + text fields)
  │
  ▼
Images saved via storage.save_file() → Azure Blob or local disk
Status set to "processing"
BackgroundTask fired → returns HTTP 200 immediately
  │
  ▼  (3 seconds later, in background)
[1] Pillow: licence photo readable + ≥ 200×100 px + brightness 20–235
      fail → rejected: "Licence photo: image too small / too dark / blank"
  ▼
[2] Pillow: licence photo is landscape orientation (width > height)
      fail → rejected: "Licence photo must be in landscape orientation"
  ▼
[3] Pillow: selfie readable + ≥ 200×100 px + brightness 20–235
      fail → rejected: "Selfie: image too small / too dark / blank"
  ▼
[4] OpenCV Haar cascade (haarcascade_frontalface_default.xml)
      at least one frontal face detected in selfie
      fail → rejected: "No face detected in your selfie"
  ▼
status = "approved", is_verified = true, verified_at = now()
```

**Libraries used:**
- `Pillow 10.4.0` — image decoding, dimension and brightness checks
- `opencv-python-headless 4.10.0.84` — Haar cascade face detection (no GUI/X11 dependencies)
- `numpy` — image array decoding for OpenCV

**Real-world equivalent:** Commercial identity verification services (Onfido, Stripe Identity, Jumio) perform the same categories of checks — document quality, orientation/authenticity, and biometric face matching. This implementation demonstrates the same pipeline concept using open-source tools, without the paid API requirement.

---

## 9. Email Verification Flow

```
User submits registration form
         │
         ▼
Backend creates user + UUID verification token in DB
Calls send_verification_email(email, token, settings)
         │
    SMTP configured?
    ┌────┴─────┐
   YES         NO
    │           │
    ▼           ▼
Gmail SMTP   Print URL to
sends HTML   Docker stdout
email        (dev fallback)
    │
    ▼ (user clicks link in email)
Browser opens: http://localhost:5173/?verify=<UUID>
         │
         ▼
App.jsx useEffect detects ?verify= param
Calls POST /auth/verify-email/<UUID>
Removes param from URL (clean history)
         │
         ▼
Token deleted from DB
user.email_verified = true
Toast: "Email verified! You can now log in."
Navigate to Auth / Login tab
```

---

## 10. Project Structure

```
CarHop/
├── backend/
│   ├── app/
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── routers/             # FastAPI route handlers
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── email.py         # Gmail SMTP verification email
│   │   │   ├── storage.py       # Unified local / Azure Blob storage
│   │   │   └── verification.py  # Pillow + OpenCV licence checks
│   │   ├── auth.py              # bcrypt helpers
│   │   ├── config.py            # Pydantic settings from env vars
│   │   ├── database.py          # SQLAlchemy engine + session factory
│   │   ├── deps.py              # FastAPI dependency injectors
│   │   ├── jwt.py               # JWT creation and validation
│   │   ├── rate_limit.py        # In-memory sliding-window rate limiter
│   │   └── security.py          # Cookie/CSRF/refresh token helpers
│   ├── alembic/versions/        # Incremental DB migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/ui/       # Card, Button, Badge, Field, Toast
│       ├── pages/               # AuthPage, ProfilePage, MarketplacePage, …
│       ├── lib/api.js           # Fetch wrapper (CSRF injection + 401 retry)
│       ├── App.jsx              # App shell, nav, session restore, URL handler
│       └── App.css              # All styles (design tokens + component styles)
├── docker-compose.yml
├── .env                         # Live credentials (gitignored)
├── .env.example                 # Template with placeholder values
└── PROJECT_AUDIT.md             # This document
```

---

## 11. Setup & Running

### Prerequisites
- Docker Desktop

### Start everything
```bash
docker-compose up --build
```

### Apply database migrations (first run, or after schema changes)
```bash
docker-compose exec api alembic upgrade head
```

### Frontend (development hot-reload)
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Environment configuration
Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `JWT_SECRET_KEY` | Any long random string |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASSWORD` | Gmail App Password (from myaccount.google.com/apppasswords) |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret key (optional) |
| `STORAGE_BACKEND` | `local` (default) or `azure` |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure storage account connection string |
| `AZURE_CONTAINER_NAME` | Blob container name (default: `carhop-uploads`) |
| `OPENAI_API_KEY` | OpenAI key for AI search (optional) |

---

## 12. Known Limitations

| Item | Notes |
|---|---|
| Licence OCR cross-check | Would need Tesseract to read and compare licence number from the uploaded image |
| Face similarity matching | Selfie is checked for face presence only; selfie↔licence photo biometric match not implemented (would need dlib/FaceNet or a paid API like Onfido) |
| Email token expiry | Verification tokens have no TTL — they remain valid indefinitely |
| Resend verification email | No endpoint; user must re-register if the email is lost |
| HTTPS | Requires a reverse proxy (nginx/Caddy) in front of uvicorn for production |
| Horizontal scaling | Rate limiter is in-memory; would need Redis for multi-instance deployment |
| Real-time messaging | Message threads poll every 5 seconds; not WebSocket-based |

---

## 13. Planned Future Development

The following features are scoped for the next development phase, prioritised by user impact and platform completeness.

---

### 13.1 Insurance & Safety Information Page ✅ COMPLETED

**What:** A dedicated informational page displayed to renters **before** they confirm any booking. The page is non-negotiable — users must scroll and acknowledge before proceeding.

**Content:**
- CarHop does not provide insurance. Renters **must hold their own fully comprehensive car insurance** that covers driving third-party vehicles, or arrange cover for the rental period before the trip begins.
- For their protection, both parties **must photograph the vehicle's condition** (all four sides, interior, and odometer) immediately before and after the rental. These photos serve as evidence in the event of a dispute.
- A **£250 refundable security deposit** is held at the time of payment. It is returned automatically after the trip concludes with no damage report filed.

**Implemented:**
- `SafetyInfoModal.jsx` — modal with three info blocks (insurance/warn, condition photos, £250 deposit) + mandatory acknowledgement checkbox. Checkbox resets each time the modal opens. "Confirm Booking" disabled until ticked.
- `MarketplacePage.jsx` — "Request Booking" now opens the modal; booking only fires on explicit confirmation.
- `InformationPage.jsx` — standalone always-visible page in the nav with the same content in a permanent format.
- No backend changes required.

---

### 13.2 Damage Report Form & Admin Complaints Page ✅ COMPLETED

**What:** Owners can file a post-trip damage report against a renter. All reports route to a new admin "Complaints" view for review and resolution.

**Implemented:**

*Backend:*
- `DamageReport` model (`damage_reports` table) — booking_id (FK CASCADE), reporter_id (FK CASCADE), description (Text), estimated_cost_pence (int nullable), photo_keys (Text — JSON array of storage keys), status (OPEN/UNDER_REVIEW/RESOLVED/DISMISSED), admin_note, created_at, resolved_at.
- Alembic migration `g6d7e8f9a0b1` creates the table with unique index on `booking_id`.
- `POST /damage-reports/booking/{id}` — owner-only, COMPLETED bookings only, one-per-booking guard, saves up to 5 photos at `damages/{booking_id}/{uuid}.ext`.
- `GET /damage-reports/booking/{id}` — owner/renter/admin.
- `GET /damage-reports/` — admin-only, optional `?status=` filter.
- `POST /damage-reports/{id}/resolve` — admin-only; sets `deposit_status` on the linked payment to `RELEASED` or `FORFEITED`.

*Frontend:*
- `DamageReportModal.jsx` — description (min 10 chars), optional cost (£), up to 5 photo previews with remove button. Uses `filesToPreviews` + `photoGrid/photoTile` pattern. Submits via `apiFetchForm`.
- `DamageReportResolveModal.jsx` — outcome selector (RESOLVED/DISMISSED), deposit decision radio (release to renter / forfeit to owner), optional admin note.
- `IncomingBookingsPage.jsx` — loads damage report for COMPLETED bookings; shows "File Damage Report" button when none exists; shows status badge when one exists.
- `AdminPage.jsx` — "Damage Reports" section with refresh button; resolve modal per report.

*Integration with deposit:*
- Escrow release blocked while any damage report is OPEN or UNDER_REVIEW.
- On admin resolution: `deposit_status` set to `RELEASED` or `FORFEITED`; `deposit_released_at` stamped.

---

### 13.3 £250 Security Deposit Simulation ✅ COMPLETED

**What:** A £250 deposit is held alongside the rental payment and released (or forfeited) after the trip.

**Implemented:**

*Backend:*
- Alembic migration `f5c6d7e8a9b0` adds `deposit_amount_pence` (int, NOT NULL, server_default 25000), `deposit_status` (String, NOT NULL, server_default `HELD`), `deposit_released_at` (DateTime tz, nullable) to `payments`.
- `Payment` model updated with three new mapped columns.
- `PaymentOut` schema updated with the same three fields.
- `pay_booking_to_escrow` — simulated and Stripe branches both set `deposit_amount_pence = 25000`, `deposit_status = "HELD"`. Stripe branch adds a second `line_item` for £250 (unit_amount 25000p).
- `release_escrow_to_owner` — blocked if `_has_open_damage_report()` returns true; on success sets `deposit_status = "RELEASED"` and stamps `deposit_released_at`.
- `_has_open_damage_report()` helper uses a lazy import to avoid circular dependency while `DamageReport` model was being created.

*Note on units:* `amount_total` is stored in **pounds** (e.g. 50 = £50); `deposit_amount_pence` is in **pence** (25000 = £250). Frontend must handle both — rental uses `amount_total.toFixed(2)` directly; deposit uses `deposit_amount_pence / 100`.

*Frontend:*
- `MyBookingsPage.jsx` — payment section shows payment status badge + "Rental: £X" + "Deposit: £250" + deposit status badge (HELD=warn, RELEASED=ok, FORFEITED=bad).
- `IncomingBookingsPage.jsx` — same itemised deposit breakdown in the owner card view.

---

### 13.4 Two-Way Reviews

**What:** Owners can review renters after a completed trip, in addition to renters reviewing cars. This builds renter reputation and helps owners make informed acceptance decisions.

**Backend changes:**

*Reviews model additions:*
```
review_type (enum: CAR_REVIEW | RENTER_REVIEW)
target_user_id (int FK, nullable — set for RENTER_REVIEW, null for CAR_REVIEW)
```

*New/updated endpoints:*
| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/reviews/{booking_id}/car` | Renter | Review the car (existing, renamed) |
| POST | `/reviews/{booking_id}/renter` | Owner | Review the renter |
| GET | `/reviews/user/{user_id}` | Anyone | Get all renter reviews for a user |

*Business rules:*
- Only after `booking.status == "COMPLETED"` and `booking.end_date` has passed.
- One review per type per booking (unique constraint on `booking_id + review_type`).
- Owner cannot review until booking is completed.

**Frontend:**
- Owner booking card: "Review Renter" button appears on completed bookings (alongside existing "Release Escrow").
- Renter profile (future profile page): displays aggregate renter rating + individual renter reviews.

---

### 13.5 Owner Availability Calendar (Date Blocking)

**What:** Owners can block specific dates on their car calendar so renters cannot book during those periods (e.g., personal use, maintenance, holidays).

**Backend — new model: `AvailabilityBlock`**
```
id, car_id (FK), start_date (date), end_date (date),
reason (text, nullable), created_at
```

**Backend — new endpoints (`/cars/{id}/availability`):**
| Method | Path | Description |
|---|---|---|
| GET | `/cars/{id}/availability` | Return all blocked date ranges for a car |
| POST | `/cars/{id}/availability/block` | Owner adds a blocked date range |
| DELETE | `/cars/{id}/availability/blocks/{block_id}` | Owner removes a block |

**Marketplace filter update:**
- `GET /cars/` already filters out cars with approved bookings overlapping the search range.
- Add equivalent filter: also exclude cars with an `AvailabilityBlock` overlapping the requested range.

**Frontend:**
- `AvailabilityCalendar` component in `MyListings` — calendar grid showing existing bookings (read-only) and owner-created blocks (clickable to add/remove). Blocked ranges rendered in red; booked ranges in amber.

---

### 13.6 Cancellation Policies

**What:** Each car listing has a cancellation policy. The refund amount on cancellation depends on the policy tier and how far in advance the cancellation is made.

**Backend changes:**

*CarListing model addition:*
```
cancellation_policy (enum: FLEXIBLE | MODERATE | STRICT, default FLEXIBLE)
```

*Policy definitions:*

| Policy | Full refund | Partial (50%) | No refund |
|---|---|---|---|
| FLEXIBLE | Up to 24 h before start | — | < 24 h |
| MODERATE | Up to 5 days before | 1–5 days before | < 24 h |
| STRICT | Up to 7 days before | 2–7 days before | < 2 days |

*Cancellation endpoint update (`POST /bookings/{id}/cancel`):*
- Calculate `hours_until_start` at time of cancellation.
- Apply policy → determine refund percentage.
- If `payment.status == HELD_IN_ESCROW`: create partial/full Stripe Refund (or simulated equivalent).
- Store `refund_amount_pence` and `cancellation_policy_applied` on the Payment record.

**Frontend:**
- Car listing detail: show policy badge (Flexible / Moderate / Strict) with tooltip explaining the terms.
- Booking cancellation confirm dialog: show calculated refund amount before the user confirms.
- `ListCarPage` / `MyListings` edit: policy selector dropdown.

---

### 13.7 Instant Book for High-Rated Hosts

**What:** Hosts with consistently high ratings can offer Instant Book — bookings are auto-approved without the owner needing to manually accept. Renters see this as a faster, more convenient option.

**Qualification criteria (server-enforced):**
- `avg_rating ≥ 4.5` across all received reviews
- `review_count ≥ 5`

**Backend changes:**

*CarListing model addition:*
```
instant_book_enabled (bool, default False)
```

*Booking creation update (`POST /bookings/{car_id}`):**
- If `car.instant_book_enabled == True` and host still qualifies (re-check at booking time):
  - Set `booking.status = "APPROVED"` immediately.
  - Skip the pending → owner approval step.
- If owner no longer qualifies (rating dropped below threshold): `instant_book_enabled` is automatically disabled at next check.

*New endpoint:*
```
PATCH /cars/{id}/instant-book   { "enabled": true/false }
```
— owner can toggle; backend validates qualification before enabling.

**Frontend:**
- "⚡ Instant Book" badge on eligible car cards in the marketplace.
- `MyListings` settings: toggle switch with eligibility status ("You qualify" / "Minimum 5 reviews with 4.5★ average required").

---

### 13.8 User Profiles & Avatars ✅ COMPLETED

**What:** Users have a visible profile with an avatar photo and short bio. This builds trust between renters and owners.

**Implemented:**

*Backend:*
- Alembic migration `e4b3a2c1d0f9` adds `avatar_key`, `avatar_url`, `bio` (all nullable String) to `users`.
- `User` model updated with three new nullable mapped columns.
- `ProfileOut` schema extended with `avatar_url` and `bio`.
- `ProfileUpdateIn` schema with `bio` field and 500-char validator.
- `PublicProfileOut` schema: id, full_name, avatar_url, bio, member_since.
- `POST /profile/avatar` — validates image MIME type + extension; deletes old blob if one exists; saves at `avatars/{user_id}/{uuid}.ext`; returns `{"avatar_url": url}`.
- `PATCH /profile/me` — updates `bio`; returns full `ProfileOut`.
- `GET /profile/user/{user_id}` — public, no auth required; returns `PublicProfileOut`.

*Frontend:*
- `ProfilePage.jsx` — 80×80px circular avatar with initials fallback; "Change photo" label triggers hidden file input; local preview via `URL.createObjectURL`; "Save avatar" fires `apiFetchForm`. Bio `TextAreaField` with `{n}/500` character counter; "Save bio" fires `apiFetch PATCH`.

*Known gap:* Marketplace car cards and booking cards do not yet display owner/renter avatars inline (scoped for a future iteration).

---

### 13.9 GDPR Compliance

**What:** Full compliance with UK GDPR / Data Protection Act 2018. Required for any platform operating in the UK that processes personal data.

**Components:**

**1. Cookie consent banner**
- On first visit, a banner explains cookie use (strictly necessary + functional).
- Consent stored in `localStorage`.
- No analytics or non-essential cookies set before consent.

**2. Right of access (data export)**
- `GET /profile/export` — returns a JSON file containing all data held about the authenticated user: account details, bookings, payments, messages, reviews, licence info (excluding photo binaries).

**3. Right to erasure (account deletion)**
- `DELETE /profile/me` — hard-deletes the user account and all associated personal data.
- Bookings, payments, and disputes are anonymised (user fields set to null / "Deleted User") rather than deleted outright, to preserve financial audit trail.
- Connected Stripe account is disconnected.
- Azure blobs for licence photos and avatar are deleted.

**4. Privacy notice in-app**
- Clear link to Privacy Policy from registration form and footer.
- Registration form: explicit "I have read and agree to the Privacy Policy" checkbox (required).

**5. Data retention information**
- Documented in Privacy Policy: what data is kept, for how long, and why.

**Backend additions:**
- `terms_accepted_at (datetime)` on User model — recorded at registration.
- `gdpr_erasure_requested_at (datetime)` on User model — soft-flag before hard delete (30-day grace period).

---

### 13.10 Terms of Service & Privacy Policy Pages

**What:** Legally required pages for any consumer-facing platform. Must be accessible before and after registration.

**Frontend — two new static page components:**

**`TermsPage`**
- Platform overview and permitted use
- User eligibility (21+, valid driving licence, own insurance)
- Owner responsibilities (accurate listing, roadworthy vehicle, valid MOT/insurance)
- Renter responsibilities (condition photos, damage reporting, deposit terms)
- Payment and fee structure (10% platform fee, £250 deposit, escrow model)
- Cancellation policy overview
- Prohibited uses
- Dispute resolution process
- Limitation of liability (CarHop is a marketplace, not an insurer)
- Governing law (England and Wales)

**`PrivacyPage`**
- Data controller details
- What personal data is collected and why
- Legal basis for processing (contract, legitimate interest, consent)
- Third-party data processors: Stripe (payments), Gmail/Google (email), Azure (file storage), OpenAI (search — optional)
- Data retention periods
- User rights under UK GDPR: access, rectification, erasure, portability, objection
- Cookie policy
- Contact details for data requests

**Navigation integration:**
- Footer links: "Terms of Service" | "Privacy Policy" visible on every page.
- Registration form: "By creating an account you agree to our [Terms of Service] and [Privacy Policy]" with clickable links (required acknowledgement).
- Backend: `terms_accepted_at` timestamp recorded at registration.

---

## 14. Implementation Sequence (Recommended)

For the next development sprint, the recommended order balances user-facing value against technical dependency:

```
Week 1:  ✅ 13.1 Safety Info Page          (no backend, immediate user value)
         ✅ 13.8 User Profiles & Avatars   (self-contained, improves trust UX)
         ✅ Information page               (static page, always visible)

Week 2:  ✅ 13.3 £250 Deposit Simulation   (payment model extension)
         ✅ 13.2 Damage Report Form        (depends on deposit logic)

Week 3:  ✅ 13.4 Two-Way Reviews           (model extension, clear scope)
         ✅ 13.5 Availability Calendar     (new model + filter update)

Week 4:  ✅ 13.6 Cancellation Policies     (car model + refund logic)
         ✅ 13.7 Instant Book              (car model + booking logic)

Week 5:  ✅ 13.10 Terms / Privacy Pages    (static content + registration update)
         ✅ 13.9  GDPR Compliance          (export, deletion, consent banner)

Week 6:  ✅ E2E test coverage              (cancellation, damage report, review, availability block)
         ✅ PROJECT_AUDIT.md updated       (all features documented, endpoints catalogued)
```
