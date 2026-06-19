# SortMyScene Booking

A full-stack event ticket booking system. Users browse events, pick seats on a visual grid, place a timed hold (10 minutes), and confirm their booking. Two users cannot end up with the same seat — the prevention is enforced at the database level, not just in application code.

## Tech Stack

- **Backend**: Node.js, Express, MongoDB Atlas (Mongoose), JWT, bcryptjs, node-cron, express-validator
- **Frontend**: React 18 (Vite), React Router v6, Axios, CSS Modules — no UI framework
- **Database**: MongoDB Atlas replica set (free M0 tier works; replica set is required for multi-document transactions)

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster. It **must** be a replica set — standalone instances don't support multi-document transactions and will throw a `Transaction numbers are only allowed on a replica member` error. Atlas enables replica sets by default on every tier, including M0 free.

## Backend Setup

```bash
cd sortmyscene-booking/backend
npm install
cp .env.example .env
# Fill in MONGODB_URI (your Atlas connection string) and JWT_SECRET (any 32+ char random string)
npm run seed      # Wipes events/seats, creates 4 events with generated seat rows
npm run dev       # Express server on port 5000
```

The seed script only wipes `Event` and `Seat` documents — users are left intact so you don't have to re-register between runs.

## Frontend Setup

```bash
cd sortmyscene-booking/frontend
npm install
cp .env.example .env
# VITE_API_BASE_URL defaults to http://localhost:5000/api, which is correct for local dev
npm run dev       # Vite dev server on http://localhost:5173
```

## Concurrency Test

This script proves double-booking is prevented. It auto-discovers a real event and available seat from the running database, registers two throwaway test users, fires two `POST /api/reserve` requests for the same seat simultaneously via `Promise.all`, and asserts exactly one gets 201 and the other gets 409.

```bash
# Backend must be running first, then:
cd sortmyscene-booking/backend
npm run seed              # Ensures fresh available seats
npm run test:concurrency  # Run the test
```

Expected output:
```
========================================================================
SortMyScene — Concurrency / Double-Booking Prevention Test
========================================================================
Target API: http://localhost:5000/api

Event selected : "The Comedy Store: Stand-Up Showcase" (...)
Seat selected  : A1 (currently available)

Authenticating test users…
  concurrencytest1@test.com → token obtained
  concurrencytest2@test.com → token obtained

Firing simultaneous POST /reserve for seat A1…

────────────────────────────────────────────────────────────────────────
User A → HTTP 201
{ "success": true, "data": { "reservationId": "...", "seatNumbers": ["A1"], "expiresAt": "..." } }
────────────────────────────────────────────────────────────────────────
User B → HTTP 409
{ "success": false, "message": "One or more selected seats are no longer available", "unavailableSeats": ["A1"] }
────────────────────────────────────────────────────────────────────────

✓ PASS — exactly one request got 201, the other got 409.
  Double-booking is correctly prevented at the database level.
```

If you see two 201s, MongoDB is likely not running as a replica set.

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account, returns JWT |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/events` | No | List all events |
| GET | `/api/events/:id` | No | Event details + seat availability summary |
| GET | `/api/events/:id/seats` | No | Full seat map with status of every seat |
| GET | `/api/events/:id/my-reservation` | Yes | Returns caller's active hold for this event, or null |
| POST | `/api/reserve` | Yes | Place a 10-minute hold on one or more seats |
| POST | `/api/bookings` | Yes | Confirm an active reservation |

All responses use a consistent envelope:
- Success: `{ success: true, data: {...} }`
- Error: `{ success: false, message: "..." }`

Notable status codes:
- `409` on `/api/reserve` — one or more requested seats were taken; body includes `unavailableSeats: [...]`
- `410` on `/api/bookings` — reservation has expired or was already completed
- `403` on `/api/bookings` — reservation belongs to a different user

## Design Decisions

**Double-booking prevention**

The naive approach — read seat status, check it's available, then update — has a classic TOCTOU race: two requests can read "available" before either has written. Even inside a transaction, if you do the check and the update as separate operations, MongoDB's snapshot isolation doesn't prevent the second transaction from seeing the same pre-write state. The fix is to fold the availability check *into the update filter itself*: `updateMany({ status: 'available', ... })`. If another request wins the race, this request's `modifiedCount` comes back short, the transaction aborts, and we return a 409. MongoDB also raises a `WriteConflict` error (code 112) when two concurrent transactions touch the same document — that error is explicitly caught and surfaced as a 409 too, not left to bubble up as a 500. The net result is that correctness is enforced at the database level regardless of what the application code around it does.

**Why cron + defensive check, not just one or the other**

The cron job (`expireReservations.js`) runs every 30 seconds. That means there's a window where a reservation has technically expired but its seats are still marked "reserved". If someone hits Confirm in that gap, a cron-only system would let the booking through on stale data. The defensive expiry check in `bookingController.js` catches this: it re-checks `reservation.expiresAt < now` on every confirm request, independently of what the cron has or hasn't cleaned up yet. The MongoDB TTL index is a third layer — it eventually deletes expired reservation documents — but it never releases seats atomically, which is why the cron exists in the first place.

**Restoring an active hold across navigations**

There was a real bug during development: if a user reserved seats, navigated away from the event page, and came back while the hold was still active, the frontend had no way of knowing a reservation existed. It would show "Reserve Selected Seats" with no timer and no Confirm button, leaving the user stuck until the hold silently expired. The fix was a `GET /api/events/:id/my-reservation` endpoint that the event detail page calls on mount alongside the other data fetches. If it finds an active hold, the page starts in "confirming" mode with the correct remaining time calculated from the stored `expiresAt`, not a freshly reset 10:00. The API response is always the source of truth — localStorage would be stale or unavailable from a different browser, so it's deliberately not trusted for this.

**JWT for auth**

Sessions would need shared state across instances (Redis or sticky sessions), which adds operational overhead. For a stateless REST API at this scale, JWTs are simpler to reason about. The downside is you can't invalidate a token before it expires without a denylist — for this scope, a 7-day expiry with client-side logout-on-401 handling is a reasonable trade.

## Assumptions

- Seat layout is a simple letter-row / numbered-column grid (A1–E10 style). There's no support for venue-specific curved maps or non-uniform layouts.
- One reservation can cover multiple seats but confirms in one go — partial confirmation isn't supported.
- A user can technically hold seats for the same event multiple times (different seats, different holds), but the UI tracks one active hold per page load. In practice the seat availability check prevents someone from hoarding the whole venue.
- `priceInINR` is display-only. No payment processing is in scope — confirm goes straight to booked.
- The `rows` and `seatsPerRow` fields on the Event model exist only for generating seat documents at seed time. The frontend renders seats from the actual Seat documents, so you could have irregular seat counts per row in production without changing the frontend.
- Email addresses are lowercased at registration and login and treated as case-insensitive identifiers.

## If I Had More Time

**WebSocket seat updates instead of polling.** The seat grid currently polls every 20 seconds while a user is in selection mode. This works, but it's wasteful and introduces up to a 20-second lag before another user's hold shows up. Socket.io with a per-event room would let the server push seat state changes to all connected clients the moment they happen. The backend transaction already knows exactly which seats changed — broadcasting that diff is straightforward once the socket infrastructure is in place.

**Idempotency keys on booking confirmation.** Right now, if a user double-clicks "Confirm Booking" or a network hiccup causes a retry, the second request will hit a 410 (reservation already completed) rather than silently completing. That's not catastrophic, but it produces a confusing error toast. An idempotency key (a client-generated UUID attached to the confirm request) would let the server detect duplicates and return the original result instead of an error.

**The localStorage-vs-API hold-restore flow could be smarter.** The current implementation calls `GET /api/events/:id/my-reservation` on every page load, which adds a round-trip. A better version would use localStorage as a first-paint optimization (show confirming mode immediately, then validate against the API in the background) rather than showing the skeleton loader while the API call resolves. The tricky part is handling the case where localStorage says a hold exists but the API says it's expired — you need to make sure the UI doesn't flash "confirming" and then flip back to "selecting" in a way the user finds confusing.
