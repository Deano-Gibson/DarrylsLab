# Architecture

- `index.html`, `online.html`, `account.html`: Vite multi-page browser entrypoints. Only the Auth endpoint URL is public.
- `api/*.js`: Vercel Functions for account reads, checkout, signed Stripe fulfillment, availability, and booking.
- `server/platform.js`: server-only Neon SQL, JWT verification against the branch JWKS, and Stripe setup.
- `server/services/google-calendar.js`: OAuth refresh, free/busy, and deterministic event creation.
- `database/schema.sql`: private Postgres tables and transaction-safe credit/booking functions.

## Money and booking invariants

1. Pack IDs, credit counts, and GBP prices are defined server-side. The browser cannot choose an amount.
2. Only a paid, signature-verified Stripe Checkout event calls `credit_paid_pack`. The unique Stripe session ID prevents double crediting.
3. API routes require a Neon Auth JWT verified against the configured JWKS and look up the current, non-banned user in Neon Auth. User IDs in URLs or request bodies are never trusted as ownership claims.
4. `reserve_training_slot` locks the slot and balance inside one Postgres transaction before spending one credit. A slot is booked at most once; balances cannot go below zero.
5. Published slots are candidates. The server checks Google free/busy and fails closed if it cannot check. The Google event ID is deterministic. A definite conflict returns the credit; an uncertain Calendar/API result leaves the reservation pending for manual reconciliation rather than risking a duplicate event.

Postgres and Google Calendar cannot share a transaction. Pending bookings require Darryl to reconcile. There is no cancellation, reschedule, refund, or owner publishing interface yet. Archived browser-only prototypes are not deployed.
