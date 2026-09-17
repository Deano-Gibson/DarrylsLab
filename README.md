# DL Coaching

A Vite multi-page site for DL Coaching. The public pages are `index.html`, `account.html`, and `online.html`; Vercel functions under `api/` handle checkout, Stripe fulfillment, Google Calendar availability, and booking. The site is **not live-commerce ready** until the external services are configured and the end-to-end checks in [the deployment runbook](docs/deployment.md) pass.

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

The three HTML files remain at the root because Vite uses them as explicit page entrypoints. The archived booking, dashboard, and original online-intake prototypes are not included in the production build. The public `online.html` now explains the service without pretending to submit a lead.

## Local checks

```sh
npm ci
npm test
npm run build
npm run dev
```

Configure the Neon and service variables in `.env.example`, then run `npm run db:setup` for the chosen Neon branch. Use `vercel dev` for `/api/*`; Vite alone does not run those endpoints. Never put server secrets in `VITE_` variables.

See [architecture](docs/architecture.md) for boundaries and booking invariants, and [deployment](docs/deployment.md) for the service configuration and launch checklist.
