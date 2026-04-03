# CarHop — Peer-to-Peer Car Sharing Platform

CarHop is a full-stack peer-to-peer car sharing web application, inspired by Turo and Airbnb. Private vehicle owners list their cars for rent and verified renters discover and book them.


---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Run with Docker Compose](#run-with-docker-compose)
  - [Run the Frontend Separately (Dev)](#run-the-frontend-separately-dev)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Booking Lifecycle](#booking-lifecycle)
- [User Roles](#user-roles)
- [Authentication & Security](#authentication--security)
- [Payments & Escrow](#payments--escrow)
- [Storage Backends](#storage-backends)
- [Testing](#testing)
- [Environment Variable Reference](#environment-variable-reference)

---

## Features

| Area | Details |
|---|---|
| **Marketplace** | Browse listings with filters: city, price range, transmission, fuel type, seats |
| **AI Search** | Natural language search powered by OpenAI |
| **Booking lifecycle** | Full state machine: Pending → Approved / Rejected / Expired / Cancelled → Active → Completed |
| **Availability** | Date-range overlap prevention using atomic DB transactions |
| **Instant Book** | Owners with 5+ reviews averaging ≥ 4.5 stars bypass the approval step |
| **Escrow payments** | Stripe-backed simulated escrow, rental amount + £250 deposit held on approval, released on completion |
| **Damage reports** | Owner files a report post-trip (description, cost estimate, up to 5 photos), deposit held until admin resolves |
| **Disputes** | Either party can escalate a booking to a formal dispute where the admin resolves with an optional note |
| **Messaging** | In-app thread between owner and renter per booking/ frontend polls every 5 s |
| **Reviews** | Both sides can leave a review after a completed trip |
| **Role-based access** | Three roles — Renter, Owner, Admin — enforced at API and object level |
| **2FA** | Optional email OTP second factor — users opt in/out from their account dashboard |
| **Admin panel** | Overview stats, user management, booking list, dispute resolution, damage report resolution, escrow controls |
| **GDPR** | Data export and account deletion (with password confirmation) |
| **Theming** | CSS variable light / dark mode |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 7, plain CSS (CSS variables) |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT (HS256, 15 min expiry) + HttpOnly refresh token cookies (7 day), CSRF double-submit |
| **Payments** | Stripe (test mode) — simulated escrow |
| **Storage** | Local disk (dev) or Azure Blob Storage (prod) |
| **AI** | OpenAI API — natural language search parsing |
| **Testing** | Vitest + React Testing Library (frontend), pytest + HTTPX (backend), Playwright (E2E) |
| **Infrastructure** | Docker Compose |

---

## Architecture

```
┌─────────────────────┐        REST / JSON          ┌──────────────────────┐
│   React 19 (Vite)   │ ◄────────────────────────►  │  FastAPI (Python)    │ 
│   Single-Page App   │    HttpOnly cookies +       │   Business logic,    │
│   port 5173         │    X-CSRF-Token header      │   RBAC, validation   │
└─────────────────────┘                             │   port 8000          │
                                                    └──────────┬───────────┘
                                                               │ SQLAlchemy ORM
                                                    ┌──────────▼───────────┐
                                                    │   PostgreSQL 16      │
                                                    │   port 5432          │
                                                    └──────────────────────┘
```

All business logic and access control lives exclusively in the backend. The frontend is a thin client that only holds local UI state.

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose v2)
- Node.js 20+ (only needed if running the frontend outside Docker)

### Environment Variables

Copy the example below into a `.env` file in the **project root** (same directory as `docker-compose.yml`). The only value you must change for local development is `JWT_SECRET_KEY`.

```dotenv
# ── Security ──────────────────────────────────────────────────────────────────
JWT_SECRET_KEY=change-me-to-a-long-random-string
REFRESH_TOKEN_PEPPER=change-me-too

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+psycopg://carhop:carhop@carhop_db:5432/carhop

# ── Cookies (set COOKIE_SECURE=true in production with HTTPS) ─────────────────
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# ── Email / SMTP (leave blank to skip sending emails) ─────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@carhop.com

# ── Stripe (leave blank to use the simulated payment fallback) ─────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ── OpenAI (leave blank to disable AI search) ─────────────────────────────────
OPENAI_API_KEY=

# ── Storage (local = uploads/ folder; azure = Azure Blob Storage) ─────────────
STORAGE_BACKEND=local
AZURE_STORAGE_CONNECTION_STRING=
AZURE_CONTAINER_NAME=carhop-uploads

# ── Frontend URL (used in reset-password emails) ──────────────────────────────
FRONTEND_BASE_URL=http://localhost:5173
```

### Run with Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/eleftherios2tsou/CarHop.git
cd CarHop

# 2. Create your .env (see above)
cp .env.example .env   # or create it manually

# 3. Start all services (API + DB) with hot-reload
docker compose up

# 4. Apply database migrations (first run only, or after pulling new migrations)
docker compose exec api alembic upgrade head
```

| URL | Service |
|---|---|
| `http://localhost:8000` | FastAPI backend |
| `http://localhost:8000/docs` | Interactive API docs (Swagger UI) |
| `http://localhost:5173` | React frontend (see below) |

> The API container mounts `./backend/app` and runs with `--reload`, so Python changes are picked up instantly without restarting the container.

### Run the Frontend Separately (Dev)

The frontend is not containerised — run it directly with Node:

```bash
cd frontend
npm install
npm run dev       # starts Vite dev server on http://localhost:5173
```

---

## Project Structure

```
CarHop/
├── docker-compose.yml
├── .env                        # not committed — see Environment Variables
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/                # database migrations
│   │   └── versions/
│   ├── uploads/                # local file storage (bind-mounted into container)
│   └── app/
│       ├── main.py             # FastAPI app, CORS, router registration
│       ├── config.py           # settings loaded from environment / .env
│       ├── deps.py             # FastAPI dependency injection (auth, CSRF)
│       ├── auth.py             # password hashing (bcrypt)
│       ├── jwt.py              # access token creation / validation
│       ├── security.py         # refresh token hashing, CSRF, cookie helpers
│       ├── rate_limit.py       # in-memory rate limiter
│       ├── models/             # SQLAlchemy ORM models
│       ├── schemas/            # Pydantic request/response schemas
│       ├── routers/            # one file per feature area
│       │   ├── auth.py         # register, login, 2FA OTP, refresh, logout
│       │   ├── profile.py      # profile, licence upload, 2FA settings
│       │   ├── cars.py         # listings CRUD, photos, availability
│       │   ├── bookings.py     # booking lifecycle
│       │   ├── payments.py     # Stripe webhooks, escrow release/forfeit
│       │   ├── damage_reports.py
│       │   ├── disputes.py
│       │   ├── messages.py
│       │   ├── reviews.py
│       │   ├── search.py       # AI natural language search
│       │   └── admin.py        # admin-only endpoints
│       └── services/
│           ├── email.py        # SMTP helpers (verification, OTP, reset)
│           ├── storage.py      # pluggable local / Azure storage
│           └── verification.py # licence image checks (Pillow + OpenCV)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── playwright.config.js
    ├── src/
    │   ├── App.jsx             # routing, auth state, profile fetch
    │   ├── lib/
    │   │   └── api.js          # apiFetch wrapper (auto-refresh on 401)
    │   ├── components/         # shared UI: Button, Badge, Card, Field, Modal…
    │   └── pages/              # one file per page + co-located *.test.jsx
    └── e2e/
        ├── journeys.spec.js    # Playwright end-to-end tests
        └── helpers/            # DB seeding, auth helpers, reusable flows
```

---

## API Overview

All endpoints are prefixed under `http://localhost:8000`. Full interactive docs at `/docs`.

| Router | Prefix | Key endpoints |
|---|---|---|
| Auth | `/auth` | `POST /register`, `/login`, `/verify-otp`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` |
| Profile | `/profile` | `GET /me`, `PATCH /me`, `DELETE /me`, `POST /2fa/send-code`, `/2fa/enable`, `/2fa/disable` |
| Cars | `/cars` | `GET /` (marketplace), `POST /` (create listing), `PUT /:id`, `DELETE /:id`, `POST /:id/photos`, availability |
| Bookings | `/bookings` | `POST /` (request), `POST /:id/approve`, `/reject`, `/cancel`, `GET /my` (renter), `GET /incoming` (owner) |
| Payments | `/payments` | `POST /:booking_id/checkout`, Stripe webhook handler, `POST /:booking_id/release` |
| Damage Reports | `/damage-reports` | `POST /`, `GET /`, `POST /:id/resolve` (admin) |
| Disputes | `/disputes` | `POST /`, `GET /open`, `POST /:id/resolve` (admin) |
| Messages | `/messages` | `GET /:booking_id`, `POST /:booking_id` |
| Reviews | `/reviews` | `POST /`, `GET /car/:car_id` |
| Search | `/search` | `POST /parse` (AI natural language → filters) |
| Admin | `/admin` | `GET /stats`, `GET /users`, `POST /users/:id/activate|deactivate`, `GET /bookings`, `POST /payments/:id/release|forfeit` |

---

## Booking Lifecycle

```
                    ┌─────────┐
         submit     │ PENDING │  no response within 24 h
        ──────────► │         │ ──────────────────────────► EXPIRED
                    └────┬────┘
               approve / │ reject
                         ▼
              ┌──────────────────┐
      reject  │    APPROVED      │  end date passed
      ───────► │  (payment held)  │ ──────────────────────► COMPLETED
              └────────┬─────────┘
               cancel  │
                       ▼
                  CANCELLED
```

Overlap prevention is enforced at the database level inside a single SQLAlchemy transaction — concurrent approval requests for the same car and date range will result in an HTTP 409 for the second caller.

Expiry and auto-completion are evaluated lazily on fetch rather than via a background scheduler.

---

## User Roles

| Role | Capabilities |
|---|---|
| **Renter** (USER) | Browse marketplace, submit booking requests, manage own bookings, file disputes, leave reviews, message owners |
| **Owner** | Everything a Renter can do, plus: create/edit/delete car listings, approve/reject bookings, file damage reports, manage availability |
| **Admin** | Everything an Owner can do, plus: view platform stats, manage all users, resolve disputes and damage reports, manually release/forfeit escrow |

Roles are enforced at two levels:
1. **Role-level** — FastAPI dependency injection rejects requests from the wrong role before the handler runs.
2. **Object-level** — handlers verify ownership (e.g. an owner can only approve bookings for their own listings).

---

## Authentication & Security

- **Access tokens** — HS256 JWT, 15-minute expiry, stored in an HttpOnly cookie (not accessible to JavaScript).
- **Refresh tokens** — UUID4, peppered SHA-256 hash stored in the database, 7-day expiry, rotated on each use.
- **CSRF protection** — Double-submit cookie pattern: a readable `csrf_token` cookie must be echoed in the `X-CSRF-Token` header on all state-modifying requests.
- **Silent refresh** — The frontend's `apiFetch` wrapper automatically POSTs to `/auth/refresh` on any 401 and retries the original request, giving seamless sessions without visible logouts.
- **Rate limiting** — Auth endpoints (login, register, OTP) are rate-limited by IP to mitigate brute-force attacks.
- **2FA** — Optional email OTP: after a correct password, a 6-digit code is emailed; the user submits it with an opaque `pending_token` to complete login.
- **Password rules** — 8–24 characters, must include uppercase, lowercase, number, and special character — enforced on both frontend and backend.

---

## Payments & Escrow

Stripe is integrated in **test mode** for payment flow scaffolding. No real money moves.

1. On booking **approval**, a Stripe Checkout session is created for the rental amount + £250 deposit.
2. The `checkout.session.completed` webhook sets the payment status to `HELD_IN_ESCROW`.
3. On trip **completion** with no damage report, funds are released: rental amount to the owner, deposit refunded to the renter.
4. If a **damage report** is filed, the deposit stays held until an admin resolves the case (`RELEASED` → owner or `FORFEITED` → renter).

All monetary values are stored as integers in pence to avoid floating-point rounding errors.

---

## Storage Backends

Controlled by the `STORAGE_BACKEND` environment variable.

| Value | Behaviour |
|---|---|
| `local` (default) | Files saved to `backend/uploads/`, bind-mounted into the container at `/app/uploads` |
| `azure` | Files uploaded to Azure Blob Storage — requires `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_CONTAINER_NAME` |

The storage abstraction lives in `backend/app/services/storage.py`. Switching backends requires only the env vars — no code changes.

---

## Testing

### Frontend unit tests (Vitest + React Testing Library)

```bash
cd frontend
npm run test:run          # run once
npm run test              # watch mode
```

72 tests across 12 files — covers auth gates, empty states, API mock responses, user interactions, and shared UI components.

### Backend unit tests (pytest)

```bash
docker compose exec api pytest
```

Covers booking state transitions, cancellation refund tiers, concurrency/overlap prevention, Stripe webhook handling, and smoke tests for listings, messages, disputes, and payments.

### End-to-end tests (Playwright)

Requires the full stack to be running (`docker compose up` + `npm run dev`).

```bash
cd frontend
npm run e2e               # headless
npm run e2e:headed        # visible browser
npm run e2e:ui            # Playwright UI mode
```

Journeys covered: registration + email verification, listing creation, booking request → approval → completion, payment escrow release, cancellation, dispute creation → admin resolution, review submission, availability blocking, password reset, GDPR data export.

---

## Environment Variable Reference

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | `dev-secret-change-me` | **Change in production.** Signs all JWT access tokens. |
| `REFRESH_TOKEN_PEPPER` | `dev-refresh-pepper-change-me` | **Change in production.** Mixed into refresh token hashes. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | JWT access token lifetime in minutes. |
| `DATABASE_URL` | postgres://carhop:carhop@... | SQLAlchemy-format connection string. |
| `COOKIE_SECURE` | `false` | Set `true` in production (requires HTTPS). |
| `COOKIE_SAMESITE` | `lax` | SameSite cookie attribute. |
| `SMTP_HOST` | _(empty)_ | SMTP server hostname. Emails silently skipped if not set. |
| `SMTP_PORT` | `587` | SMTP port. |
| `SMTP_USER` | _(empty)_ | SMTP username. |
| `SMTP_PASSWORD` | _(empty)_ | SMTP password. |
| `SMTP_FROM` | `noreply@carhop.com` | Sender address for outgoing emails. |
| `STRIPE_SECRET_KEY` | _(empty)_ | Stripe test secret key. Falls back to simulated payments if absent. |
| `STRIPE_WEBHOOK_SECRET` | _(empty)_ | Stripe webhook signing secret for event verification. |
| `OPENAI_API_KEY` | _(empty)_ | OpenAI key for AI search. Feature disabled if absent. |
| `STORAGE_BACKEND` | `local` | `local` or `azure`. |
| `AZURE_STORAGE_CONNECTION_STRING` | _(empty)_ | Required when `STORAGE_BACKEND=azure`. |
| `AZURE_CONTAINER_NAME` | `carhop-uploads` | Azure Blob container name. |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | Used in password-reset email links. |

---

## Licence

Academic project — University of the West of England, Bristol, 2025–2026.
