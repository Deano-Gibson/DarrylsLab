# Enquiry launch

The public in-person page saves an enquiry before attempting email. Signup is disabled in Neon Auth. Availability and booking require a verified account with an active row in `client_access`; no existing account is approved automatically. Enquiry status does not itself grant booking access.

Run `node scripts/setup-enquiries.js` to install storage and disable public signup. Run `node scripts/list-enquiries.js` to review saved enquiries while notifications are off. This prints personal details: use a private terminal, not shared logs. Darryl can also receive enquiries directly at the Gmail link on the page.

Email is optional. Without `GMAIL_APP_PASSWORD`, messages remain pending and the page truthfully says email confirmations are unavailable. `GMAIL_USER` defaults to `GOOGLE_OWNER_EMAIL`. A future Resend adapter can replace the transport without changing enquiry capture. Never expose mail credentials in browser code.

The mail outbox prevents concurrent sends. SMTP errors with uncertain delivery remain `uncertain`; do not blindly resend those messages. Pending messages are not automatically drained: choose an email provider and review old enquiries before activating a retry worker.

Workflow statuses: new, contacted, call_arranged, approved, closed. A coach inbox/status editor and secure client invitation flow remain a later phase. Until that exists, review enquiries through the private script and arrange calls manually. Do not promise automatic notifications are active.
