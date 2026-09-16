# Architecture

## Live surfaces

- `index.html`: public marketing page, built from `src/pages/site.js`, `src/styles/base.css`, and `src/styles/home.css`.
- `account.html`: client sign-in, credit packs, availability, and bookings, built from `src/pages/site.js`, `src/pages/account.js`, `src/styles/base.css`, and `src/styles/account.css`.
- `online.html`: informational page. Online applications are deliberately closed until a secure intake and owner workflow exist.
- `api/*.js`: Vercel Request/Response functions. No server secret is imported by browser code.

## Booking invariants

1. Pack IDs and prices are defined server-side in `server/platform.js`. The browser sends a pack ID, never an amount.
2. A signed Stripe webhook calls `credit_paid_pack`. A unique checkout session ID prevents duplicate credits on retry.
3. Only the server can call `reserve_training_slot` and `rollback_calendar_booking`. The database transaction locks the slot and balance before spending a credit.
4. Published database slots are candidates, not a promise of availability. The availability and booking endpoints check Google Calendar free/busy. If that check fails, no new booking is offered.
5. Google Calendar and Postgres cannot share a transaction. A definite calendar conflict returns the credit; an uncertain insertion leaves the booking pending and reserved for manual reconciliation. The system must not silently create a second event or refund a possibly booked appointment.

## Boundaries and current gaps

`public/assets` contains deployable static files. `archive/prototypes` contains historical localStorage demos and must remain outside the Vite entrypoints and public navigation. Do not copy prototype data into production without a migration and consent review.

There is not yet an owner admin interface for publishing slots, cancellation/rescheduling/refund automation, a live online-coaching intake, or a verified production integration test. These are launch work, not hidden demo features.
