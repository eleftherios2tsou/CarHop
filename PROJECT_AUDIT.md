# CarHop — Project Audit

**Module:** Web Application Development
**Institution:** University of the West of England (UWE Bristol)
**Last updated:** February 2026

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
│  /uploads — Static file serving (images)         │
└────────────┬─────────────────┬───────────────────┘
             │                 │
             ▼                 ▼
    PostgreSQL :5432      Gmail SMTP
    (carhop DB)           (email verification)
```

### Key architectural decisions
- **Cookie-based sessions** (httpOnly, SameSite=Lax) rather than localStorage tokens — prevents XSS token theft.
- **CSRF double-submit pattern** — unsafe HTTP methods require an `X-CSRF-Token` header matching a cookie value.
- **Refresh token rotation** — each refresh invalidates the old token and issues a new one; stored hashed in the DB.
- **Background tasks** — licence verification runs as an async FastAPI `BackgroundTask` so the upload endpoint returns immediately while processing continues server-side.

---

## 4. Database Schema

### Tables

| Table | Purpose |
|---|---|
| `users` | Core identity — email, password hash, name, DOB, role, Stripe account |
| `email_verification_tokens` | UUID token issued on registration, deleted on verify |
| `refresh_tokens` | Hashed refresh tokens with expiry and revocation flag |
| `driver_licenses` | Licence details + photo storage paths + verification status |
| `cars` | Car listings with all rental attributes |
| `car_photos` | Up to 8 photos per car (local or S3 storage) |
| `bookings` | Booking requests with status state machine |
| `payments` | Stripe PaymentIntent + charge/transfer/refund IDs |
| `messages` | Per-booking message thread |
| `reviews` | Post-rental reviews by renters |
| `disputes` | Dispute records linked to bookings |
| `stripe_webhook_events` | Idempotency log for processed Stripe webhooks |

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
- [x] Images saved to `uploads/licenses/{user_id}/` on server
- [x] **Pillow** quality checks: minimum resolution (200×100 px), not blank, not too dark
- [x] **Pillow** orientation check: licence must be landscape (card-shaped)
- [x] **OpenCV Haar cascade** face detection: selfie must contain a human face
- [x] All checks run as an async background task (~3 s processing delay)
- [x] Status transitions: `pending → processing → approved / rejected / manual_review`
- [x] Admin can manually approve or reject with a reason
- [x] Frontend polls every 3 s while `status === "processing"` and auto-updates UI

### Car Listings
- [x] Create / update / delete car listings
- [x] Up to 8 photos per car (MIME + extension validation)
- [x] Fields: make, model, year, city, price/day, transmission, fuel type, seats, description
- [x] Date-range availability filtering in marketplace search
- [x] Pagination (20 cars per page)

### Booking Flow
- [x] Renters submit booking requests with date range
- [x] Owners approve or reject incoming bookings
- [x] Booking status state machine: `pending → approved / rejected / cancelled / completed`

### Payments (Stripe)
- [x] Stripe PaymentIntents — card charge on booking approval
- [x] Stripe Connect — owners connect a payout account (Express)
- [x] Escrow model — funds held until rental completes, then transferred to owner
- [x] Refund support via `stripe_refund_id`
- [x] Webhook idempotency — duplicate Stripe events silently ignored

### Messaging & Reviews
- [x] Per-booking message thread between owner and renter
- [x] Post-rental reviews by renters

### Disputes
- [x] Dispute records linked to bookings with admin resolution

### Admin
- [x] Admin dashboard for licence approval / rejection
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
| GET | `/profile/me` | Get full profile including licence status |
| POST | `/profile/license` | Submit licence photos + details (multipart) |
| POST | `/profile/license/{user_id}/verify` | Admin: approve licence |
| POST | `/profile/license/{user_id}/reject` | Admin: reject licence with reason |
| POST | `/profile/payout/onboard` | Start Stripe Connect Express onboarding |
| POST | `/profile/payout/refresh` | Sync Stripe Connect payout status |

### Cars — `/cars`
| Method | Path | Description |
|---|---|---|
| GET | `/cars/` | Paginated marketplace listings with filters |
| POST | `/cars/` | Create listing |
| GET | `/cars/{id}` | Car detail |
| PUT | `/cars/{id}` | Update listing |
| DELETE | `/cars/{id}` | Delete listing |
| POST | `/cars/{id}/photos` | Upload photos (multipart, max 8) |
| DELETE | `/cars/{id}/photos/{photo_id}` | Delete a photo |

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
Images saved to disk: uploads/licenses/{user_id}/
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
│   │   │   └── verification.py  # Pillow + OpenCV licence checks
│   │   ├── auth.py              # bcrypt helpers
│   │   ├── config.py            # Pydantic settings from env vars
│   │   ├── database.py          # SQLAlchemy engine + session factory
│   │   ├── deps.py              # FastAPI dependency injectors
│   │   ├── jwt.py               # JWT creation and validation
│   │   ├── rate_limit.py        # In-memory sliding-window rate limiter
│   │   └── security.py          # Cookie/CSRF/refresh token helpers
│   ├── alembic/versions/        # 13 incremental DB migrations
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
└── Project_Audit.md             # This document
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

---

## 12. Known Limitations & Future Work

| Item | Notes |
|---|---|
| S3 file storage | Configuration present, not implemented — files stored on local disk |
| Licence OCR cross-check | Would need Tesseract to read and compare licence number from the image |
| Face similarity matching | Selfie is checked for a face presence only; selfie↔licence photo biometric match not implemented (would need dlib/FaceNet or a paid API) |
| Email token expiry | Verification tokens have no TTL — they remain valid indefinitely |
| Resend verification email | No endpoint; user must re-register if the email is lost |
| HTTPS | Requires a reverse proxy (nginx/Caddy) in front of uvicorn for production |
| Horizontal scaling | Rate limiter is in-memory; would need Redis for multi-instance deployment |
