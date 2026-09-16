# Deployment runbook

The in-person account flow requires Supabase, Stripe, Google Calendar, and a server-capable deployment. It fails closed when those services are not configured. The original browser-only online intake is preserved under `archive/prototypes/online` and is not deployed.

## How in-person sessions work

1. A client enters an email on `account.html`; Supabase Auth emails a magic link. Confirmed users can see their balance and published slots.
2. Stripe Checkout charges the server-defined pack price: 1 / £45, 2 / £80, or 8 / £250. The browser cannot set a price or issue credits.
3. Stripe calls `/api/stripe-webhook` with a signed event. Only a paid checkout credits the account. The checkout session ID is unique, so retries do not duplicate credits.
4. The server checks Darryl's Google Calendar free/busy. `reserve_training_slot` locks the slot and balance in one database transaction and deducts one credit. It rechecks the calendar and inserts an event with the client invited. A definite conflict returns the credit; an uncertain Calendar/API failure leaves a visible pending booking for manual reconciliation rather than risking a duplicate appointment or credit.

## Setup before taking real payments

1. Create a Supabase project and review and run [`database/schema.sql`](../database/schema.sql) in its SQL editor. This is a setup script, not an applied migration. Check the RLS policies and run the Supabase security advisors. Create test users and verify another user cannot read their purchases, balance, or bookings.
2. Configure email delivery with a custom SMTP provider. Add the production `https://YOUR_DOMAIN/account.html` and local development URLs to Supabase Auth redirect allow-list. Confirm your email templates and rate limits.
3. Create a Stripe account and webhook endpoint `https://YOUR_DOMAIN/api/stripe-webhook`, subscribed to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Use test keys and a test webhook secret first. Configure tax/VAT, receipts, refund policy, dispute handling, and business details in Stripe.
4. Deploy to Vercel (or a platform supporting the Web Request/Response serverless functions in `api/`). Set all variables from [`.env.example`](../.env.example). `VITE_` values are public; the Supabase secret and Stripe keys must remain server-only. Set `PUBLIC_SITE_URL` to your deployed origin, with no path. Never deploy this as GitHub Pages alone: static hosting does not run the checkout/webhook functions.
5. Enable Google Calendar API in a Google Cloud project. Create a **Web application** OAuth client with authorized redirect URI `http://localhost:8765/callback`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` locally, then run `node scripts/connect-google-calendar.js` and have Darryl authorize his own Google account. Store the resulting `GOOGLE_REFRESH_TOKEN` only in deployment secrets; set `GOOGLE_CALENDAR_ID` to `primary` or the calendar ID he authorized. The app requests event-write and free/busy scopes. A Google OAuth consent screen in External/Testing mode issues refresh tokens that expire after seven days; publish/configure the OAuth app appropriately before launch. Calendar access can also be revoked, so monitor failed availability requests. [Google OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server), [Google consent status](https://support.google.com/cloud/answer/15549945).
6. Publish actual one-hour potential availability in `training_slots` via the Supabase SQL editor or a protected admin tool. Google Calendar **blocks busy times** within these published slots; it does not generate Darryl's working hours. Do not advertise availability until Darryl confirms it. Existing booked slots stay unavailable; cancellations, rescheduling, refunds, and pending-booking reconciliation require a staffed policy/workflow.
7. Verify a complete test purchase, a replayed webhook, booking the last credit, two clients attempting the same slot, external Google events blocking times, invitations reaching clients, UK daylight-saving display, a Google outage/pending booking, and a failed payment. Switch to live keys only after all pass.
8. Add a privacy notice, terms, cancellation/refund policy, verified contact address and business location. Confirm the public domain in `public/sitemap.xml` and `public/robots.txt`. Build a real online-coaching intake before opening applications.

## Local development

`npm ci`, copy `.env.example` to `.env.local` and set the public values, then `npm run dev`. The Vite dev server serves the static client; use `vercel dev` to exercise `/api/*` locally. Run `npm run build` for a production asset build. No live external service is connected merely by building this repository.

The original browser-only pages are under [`archive/prototypes`](../archive/prototypes) and excluded from the production build. The homepage sends in-person clients to `account.html`.
