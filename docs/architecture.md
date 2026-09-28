# Architecture

- `index.html`, `online.html`, `account.html`, `connect-calendar.html`: Vite multi-page browser entrypoints. Only the Auth endpoint URL is public.
- `api/*.js`: Vercel Functions for account reads, availability, and booking. Checkout returns 403 while payments are paused; signed Stripe fulfillment is retained for legacy checkouts.
- `server/platform.js`: server-only Neon SQL, JWT verification against the branch JWKS, and Stripe setup.
- `server/services/google-calendar.js`: refreshes the saved connection, checks free/busy, and creates deterministic events. Access-token caching is keyed by the current credential fingerprint so reconnects replace cached access.
- `server/services/calendar-oauth.js`: same-origin POST initiation; browser-bound, single-use, ten-minute state; PKCE; Google ID-token signature/issuer/audience/expiry and nonce validation; verified owner email allowlist; granted-scope checks; free/busy validation before saving.
- `server/services/calendar-store.js`: private OAuth attempt and connection storage. Reconnects are pinned to Google's stable account subject. No browser-role RLS policies expose these tables.
- `server/services/calendar-secrets.js`: AES-256-GCM with random IVs, authenticated context, and a separate deployment encryption key. Only ciphertext is stored for refresh tokens and PKCE verifiers; no OAuth payloads are logged.
- `database/schema.sql`: private Postgres tables and transaction-safe credit/booking functions.

## Money and booking invariants

1. No new online payments can be initiated. Package prices remain informational; payment is arranged directly with Darryl.
2. Legacy Stripe fulfillment still verifies signatures, paid status, metadata, currency, and amount before calling `credit_paid_pack`. The unique Stripe session ID prevents double crediting. Existing credit balances are preserved.
3. API routes require a Neon Auth JWT verified against the configured JWKS and look up the current, non-banned user in Neon Auth. User IDs in URLs or request bodies are never trusted as ownership claims.
4. `reserve_training_slot` locks the slot inside one Postgres transaction without requiring or spending credits. A slot is booked at most once. New bookings record `credits_spent = 0`; older bookings retain `1` so rollback only restores a credit that was actually spent.
5. Published slots are candidates. The server checks Google free/busy and fails closed if it cannot check. The Google event ID is deterministic. A definite conflict releases the reservation; an uncertain Calendar/API result leaves it pending for manual reconciliation rather than risking a duplicate event.

Postgres and Google Calendar cannot share a transaction. Pending bookings require Darryl to reconcile. There is no cancellation, reschedule, refund, or owner publishing interface yet. Archived browser-only prototypes are not deployed.

The public coach connection page requires Google consent, not a Neon account. Public status only exposes readiness and whether a saved connection exists; no email or credentials. OAuth callbacks redirect to a clean page with a fixed result code, using no-store and no-referrer headers. Booking reads the encrypted server connection and fails closed when it cannot be decrypted or refreshed.
