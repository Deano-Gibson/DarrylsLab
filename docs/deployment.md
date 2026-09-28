# Deployment runbook

The account stack is Neon Postgres + Neon Auth, Google Calendar, and Vercel Functions. Online payments are paused. Customers book without credits and arrange payment directly with Darryl. Complete the checks below before opening bookings.

## Environment

Set the Neon and Google values in [`.env.example`](../.env.example) in Vercel Production, Preview, and local development as appropriate. `DATABASE_URL`, Stripe keys, and Google credentials are server-only. `VITE_NEON_AUTH_URL` is public and must match `NEON_AUTH_URL`; the JWKS URL is the Auth URL plus `/.well-known/jwks.json`. Use the endpoint URLs supplied by Neon for the same database branch as `DATABASE_URL`.

The ignored local `.env` is now in `KEY=value` form. Do not commit it. Add the same values to Vercel; local files do not reach production automatically. Redeploy after adding variables. Stripe keys are optional and only needed to fulfill legacy payments.

## Initial setup

1. In Neon, enable Auth for the database branch, add the production domain and local development origin as trusted origins, and configure email delivery. The current account page uses email/password signup. Enable email verification and password-reset emails before launch; review Neon Auth's password and rate-limit settings. Test signup, sign-in, sign-out, and a second user's isolation. The current branch's Auth config does **not** require email verification yet.
2. Run `npm run db:setup` against the intended Neon branch. This applies [`database/schema.sql`](../database/schema.sql) in a transaction and verifies the account table. It is safe to rerun for this schema version. Do not run it against a database with an unrelated existing `session_*` schema without reviewing the SQL.
3. Checkout is disabled at `/api/checkout`, even if Stripe keys are present. No Stripe setup is required for booking. Keep the signed webhook configured only if legacy checkouts still need fulfillment.
4. Follow [hosted Google Calendar setup](calendar-connection.md). Configure the exact HTTPS `PUBLIC_SITE_URL`, `GOOGLE_OWNER_EMAIL`, OAuth client ID/secret, and `CALENDAR_TOKEN_ENCRYPTION_KEY` in the server environment. Add `${PUBLIC_SITE_URL}/api/google-calendar-callback` to Google's authorized redirect URIs. Darryl then opens `/connect-calendar.html` on his own device and authorizes access; the refresh token is stored encrypted in Neon. The local helper is no longer required.
5. Darryl's confirmed schedule is every day 06:00–18:00 Europe/London, except Tuesday 13:00–18:00 and Thursday 08:00–13:00. The last session starts at 17:00. `npm run slots:publish` seeds the next 60 days; authenticated availability requests extend that rolling window automatically. Existing closed/booked rows are never reopened by publication. Both availability and booking enforce the weekly rules, and Google Calendar removes busy periods. An owner interface for closing days or individual slots remains future work.

## Launch checks

The in-person catalogue is now £45 for one session, Starter £150 for four,
Transformation £250 for eight, and Complete Transformation £450 for sixteen.
Package prices are informational; no purchase buttons or credit requirements are shown.
Run `npm run db:setup` before deploying the booking change. It removes the credit
requirement and records whether an older booking spent a credit, so conflict
rollback cannot accidentally create credits for new bookings.

On 25 September 2026, the confirmed training schedule was published. Neon Auth's
trusted origins now include `https://darryls-lab.vercel.app`, fixing `INVALID_ORIGIN`
on signup. The browser reads the SDK session JWT and the server verifies the Auth
host as issuer and audience (without the `/neondb/auth` API path). Signup, sign-in,
sign-out, and account access are tested with temporary accounts that are removed
after verification. Darryl's calendar authorization is still required to accept bookings.
The owner allowlist, encryption key, Google client credentials, and Neon settings
are configured in Vercel Production for DKDigital / darryls-lab. The deployment
was promoted to `https://darryls-lab.vercel.app` and verified publicly. Calendar
status reports ready but not connected; checkout returns 403, unauthenticated
booking returns 401, and invalid calendar callbacks redirect safely. Darryl must
register the callback and corrected test-user email (`darryllabuschagne14@gmail.com`)
in his Google Cloud project. See the hosted setup guide for the exact address.

Run `npm test`, `npm run build`, `npm run test:db`, and `npm run test:schedule-db`, then exercise a full test
signup → availability → booking → Google event/invitation once Calendar is connected
and candidate slots are published. Verify two users racing for one slot, booking
with no credit balance, UK daylight-saving display, Calendar outages, and pending
booking reconciliation. Test calendar connection denial, wrong-account rejection, reconnect, and an expired callback. Confirm `/api/checkout` returns 403. Add privacy/terms/
cancellation and verified contact details, and confirm the domain in the sitemap
and robots file.

The site does not yet have an owner admin interface, self-service cancellations/refunds, or a working online-coaching application. Those remain launch decisions, not implemented features.

## Local development

Use `npm ci`, then `vercel dev` for the account and `/api/*` routes. `npm run dev` serves Vite pages but not the API. The `.env` connection string is not a browser value. Keep credentials out of `VITE_` variables except the public Neon Auth URL.
