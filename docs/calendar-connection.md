# Hosted Google Calendar connection

Darryl opens `/connect-calendar.html` on the hosted website, chooses **Connect Google
Calendar**, signs into Google, approves access, and returns to a confirmation page.
He needs no project access, terminal, website account, or shared password. There is
also a **Coach calendar setup** link in the account page footer.

## Server setup

1. Run `npm run db:setup` on the target branch to create the private connection and
   OAuth attempt tables. Keep Preview and Production databases separate.
2. Set these server variables in the hosting project:
   - `DATABASE_URL`: the server database owner's connection (can bypass table RLS).
   - `PUBLIC_SITE_URL`: the exact HTTPS origin Darryl will visit.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the existing Web OAuth client.
   - `GOOGLE_OWNER_EMAIL`: Darryl's exact Google email. The verified Google claim
     must match; a client-supplied email cannot grant access.
   - `GOOGLE_CALENDAR_ID`: `primary`, or a calendar owned by that Google account.
   - `CALENDAR_TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hex characters.
     Generate once with Node's `crypto.randomBytes(32).toString('hex')`; keep it as
     a sensitive server secret and preserve it across deployments.
3. In **Google Cloud → Google Auth Platform → Clients**, edit the Web OAuth client.
   Add `https://YOUR_DOMAIN/api/google-calendar-callback` to **Authorized redirect
   URIs**. It must match the host, path, protocol, and port exactly. Keep the local
   redirect only if the local development helper is still needed.
4. Enable **Google Calendar API** in that Google project. Configure the consent
   screen. If the app is in Testing, add Darryl as a test user. Calendar consent
   in External/Testing can expire after seven days; use the appropriate production
   consent configuration for a persistent booking connection.
5. Deploy the site and send Darryl `https://YOUR_DOMAIN/connect-calendar.html`.
   He should approve both calendar permissions. The site verifies his Google ID
   token, checks calendar access, and saves the encrypted refresh token in Neon.

The checkout is linked to **DKDigital / darryls-lab**, whose production address is
`https://darryls-lab.vercel.app`. The connection page will be
`https://darryls-lab.vercel.app/connect-calendar.html`; register this exact redirect:

```text
https://darryls-lab.vercel.app/api/google-calendar-callback
```

On 23 September 2026, the approved production variables were uploaded and the
site was deployed and promoted to this address. The public page loads, its status
endpoint reports configured but not connected, and the button reaches Google.
Google currently returns `redirect_uri_mismatch`: Darryl manages the Google Cloud
project and must add the exact callback above before authorizing his account.
If the consent app is in Testing, add `darryllabuschagne14@gmail.com` as a test user.
The Google Calendar API must also be enabled. No refresh token has been saved yet.

## Credential handling

The encryption key stays in hosting secrets, separate from database ciphertext.
Google's access token is used only on the server. The refresh token and PKCE
verifier are encrypted with AES-256-GCM; OAuth state is hashed, expires after ten
minutes, is bound to an HttpOnly browser cookie, and can be consumed only once.
Production cookies are Secure and SameSite=Lax. The callback validates Google's
signature, issuer, audience, expiration, nonce, verified email, and granted scopes.
The initial Google subject is pinned in the connection row so another account
cannot replace it through an email reassignment.

No tokens are returned by public status endpoints, logged, stored in localStorage,
or put in public environment variables. The stored connection is read automatically
by availability and booking; no redeploy is needed after Darryl consents. The
optional `.env` refresh token from the old helper is used only in local development.

If access is revoked or expires, Darryl reconnects on the same page. A failed or
denied attempt does not replace an existing saved connection. Lost encryption
keys require a new connection. To intentionally change to another Google owner,
an operator must explicitly remove the old connection row and update the allowlist.
Darryl can revoke the grant in [Google account connections](https://myaccount.google.com/connections).

## Verification

`npm test` covers encryption/tampering, same-origin initiation, PKCE, browser binding,
expiry, replay, denied consent, wrong/unverified accounts, nonce/audience/issuer/
signature checks, missing scopes/offline tokens, and provider/storage failures.
`npm run test:calendar-db` exercises the actual storage queries in a rolled-back
database transaction on a branch without an existing calendar connection. It
checks state consumption/expiry/browser binding, encrypted save/reconnect, Google
subject pinning, and RLS. `npm run test:db` covers the booking database flow.
Complete one real consent from Darryl and one real booking after deployment and
after publishing his training hours. Unit tests do not stand in for that consent.

Sources: [Google web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Calendar scopes](https://developers.google.com/workspace/calendar/api/auth).
