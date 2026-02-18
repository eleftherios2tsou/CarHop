# CarHop Project Memory

## What is this project
P2P car rental marketplace (like Airbnb for cars). UWE Bristol project.
Stack: React 19 + Vite (frontend), FastAPI + PostgreSQL + SQLAlchemy (backend), Docker Compose.

## Key file paths
- Frontend entry: `frontend/src/App.jsx` (slim, ~240 lines)
- Pages: `frontend/src/pages/`
- UI components: `frontend/src/components/ui/`
- API helpers: `frontend/src/lib/api.js`, `frontend/src/lib/photos.js`
- Backend routers: `backend/app/routers/`
- Models: `backend/app/models/`
- Docker: `docker-compose.yml`

## Frontend structure (post-refactor)
App.jsx → only holds: profile, active (nav), toast, isAuthed, isAdmin, gates, navItems, logout
Pages are self-contained (own data fetching + local state):
- MarketplacePage, AuthPage, VerifyEmailPage, ProfilePage
- ListCarPage, MyListingsPage, IncomingBookingsPage, MyBookingsPage, AdminPage
EditListingModal lives in components/, used by MyListingsPage.

## What has been done
1. Refactored App.jsx (1700 lines) into 19 separate files ✅
2. Search & filters on marketplace ✅
   - Backend: city (ilike), min_price, max_price, transmission, fuel_type, min_seats
   - Frontend: collapsible filter panel, active filter chips, result count
3. Docker hot-reload: volume mount + --reload flag on uvicorn ✅

## Roadmap — what's next (in order)
### Phase 1 — Polish (remaining)
4. Owner profile on listing card (name, member since, no. of listings) — quick win
5. Email notifications (booking approved/rejected/cancelled) — completes the loop
6. Availability calendar on listing detail page

### Phase 2 — Real marketplace
7. Reviews & ratings (after booking completes, both parties rate each other)
8. Stripe payments (biggest missing piece)
9. Messaging between owner and renter

## User preferences
- Works collaboratively, confirms direction before each feature
- Wants to understand what's being built
- Project is for university (UWE Bristol) but also portfolio quality
