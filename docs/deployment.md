# Deployment runbook

The account stack is Neon Postgres + Neon Auth, Stripe Checkout, Google Calendar, and Vercel Functions. A database connection alone does not activate payments or booking. Keep the site closed to paid bookings until the end-to-end checks below pass.

## Environment

Set every value in [`.env.example`](../.env.example) in Vercel Production, Preview, and local development as appropriate. `DATABASE_URL`, Stripe keys, and Google credentials are server-only. `VITE_NEON_AUTH_URL` is public and must match `NEON_AUTH_URL`; the JWKS URL is the Auth URL plus `/.well-known/jwks.json`. Use the endpoint URLs supplied by Neon for the same database branch as `DATABASE_URL`.

The ignored local `.env` is now in `KEY=value` form. Do not commit it. Add the same values to Vercel; local files do not reach production automatically. Redeploy after adding variables. `PUBLIC_SITE_URL` must be the live HTTPS origin.

## Initial setup

1. In Neon, enable Auth for the database branch, add the production domain and local development origin as trusted origins, and configure email delivery. The current account page uses email/password signup. Enable email verification and password-reset emails before launch; review Neon Auth's password and rate-limit settings. Test signup, sign-in, sign-out, and a second user's isolation. The current branch's Auth config does **not** require email verification yet.
2. Run `npm run db:setup` against the intended Neon branch. This applies [`database/schema.sql`](../database/schema.sql) in a transaction and verifies the account table. It is safe to rerun for this schema version. Do not run it against a database with an unrelated existing `session_*` schema without reviewing the SQL.
3. In Stripe, set a webhook endpoint at `https://YOUR_DOMAIN/api/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Put its signing secret and the matching API secret in Vercel. Test with Stripe test mode, including a replayed webhook; the checkout session ID makes crediting idempotent. Configure receipts, taxes, refund/cancellation policy, and business details before live mode.
4. Enable Google Calendar API. Create a Web OAuth client with local redirect `http://localhost:8765/callback`, run `node scripts/connect-google-calendar.js`, and have Darryl authorize his calendar. Store the resulting refresh token only as a server secret. Set `GOOGLE_CALENDAR_ID`. A Google OAuth consent screen left in External/Testing mode may yield a refresh token expiring after seven days; configure it for production. [Google OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).
5. Publish one-hour candidate hours in `training_slots` using the Neon SQL editor. Google Calendar removes busy periods from those candidates; it does not generate working hours. Avoid publishing until Darryl confirms the schedule.

## Launch checks

Run `npm test`, `npm run build`, then exercise a full test signup → checkout → signed webhook → credit balance → booking → Google event/invitation. Verify two users racing for one slot, last-credit booking, UK daylight-saving display, Stripe webhook replay, a failed payment, Calendar outages, and pending-booking reconciliation. Do not turn on live Stripe keys until those pass. Add privacy/terms/cancellation and verified contact details, and confirm the domain in the sitemap and robots file.

The site does not yet have an owner admin interface, self-service cancellations/refunds, or a working online-coaching application. Those remain launch decisions, not implemented features.

## Local development

Use `npm ci`, then `vercel dev` for the account and `/api/*` routes. `npm run dev` serves Vite pages but not the API. The `.env` connection string is not a browser value. Keep credentials out of `VITE_` variables except the public Neon Auth URL.
