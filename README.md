# DL Coaching

A Vite multi-page site for DL Coaching. The public pages are `index.html`, `account.html`, `online.html`, and `connect-calendar.html`; Vercel functions under `api/` handle accounts, Google Calendar availability, and booking. **Online payments are paused:** signed-in customers book without buying or spending credits and arrange payment directly with Darryl. Checkout is disabled; the signed Stripe webhook remains available for any legacy payments. Complete the configuration and checks in [the deployment runbook](docs/deployment.md) before launch.

## Project layout

```text
api/                  Vercel HTTP entrypoints only
server/               Server-only Neon, Stripe, and Calendar logic
src/pages/            Browser scripts for live pages
src/styles/           Shared CSS foundation and page styles
public/assets/        Static images and favicon
database/             Reviewed SQL setup (not an applied migration)
scripts/              One-time Google Calendar authorization helper
tests/                Automated tests
docs/                 Architecture and deployment guidance
archive/prototypes/   Preserved, non-deployed browser-only demos
```

The four HTML files remain at the root because Vite uses them as explicit page entrypoints. The archived booking, dashboard, and original online-intake prototypes are not included in the production build. The public `online.html` now explains the service without pretending to submit a lead.

## Local checks

```sh
npm ci
npm test
npm run build
npm run dev
```

Configure the Neon and service variables in `.env.example`, then run `npm run db:setup` for the chosen Neon branch. Use `vercel dev` for `/api/*`; Vite alone does not run those endpoints. Never put server secrets in `VITE_` variables.

For Google Calendar, configure the server variables in `.env.example` and add
`https://YOUR_DOMAIN/api/google-calendar-callback` as an authorized redirect URI
in the Google OAuth client. Send Darryl `https://YOUR_DOMAIN/connect-calendar.html`.
He signs into Google on his own device and approves calendar access. Only the
configured `GOOGLE_OWNER_EMAIL` is accepted. The refresh token is encrypted in
Neon; it never needs to be copied from his device or placed in browser storage.
See [the hosted connection setup](docs/calendar-connection.md).

`npm run calendar:connect` remains a local development helper. Hosted deployments
use the encrypted database connection. Published `training_slots` are still required.

See [architecture](docs/architecture.md) for boundaries and booking invariants, and [deployment](docs/deployment.md) for the service configuration and launch checklist.
