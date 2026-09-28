import { db } from '../platform.js';
import { unseal } from './calendar-secrets.js';

export function createCalendarStore(getSql = db) {
  return {
    async begin(attempt) {
      const sql = getSql();
      await sql.transaction([
        sql`delete from public.calendar_oauth_attempts where expires_at < now()
        or browser_hash = ${attempt.browserHash}`,
        sql`insert into public.calendar_oauth_attempts
        (state_hash, browser_hash, verifier_encrypted, nonce, expires_at)
        values (${attempt.stateHash}, ${attempt.browserHash}, ${attempt.verifierEncrypted},
          ${attempt.nonce}, now() + interval '10 minutes')`,
      ]);
    },
    async consume(stateHash, browserHash) {
      const rows = await getSql()`delete from public.calendar_oauth_attempts
      where state_hash = ${stateHash} and browser_hash = ${browserHash} and expires_at > now()
      returning verifier_encrypted, nonce`;
      return rows[0];
    },
    async read() {
      const rows = await getSql()`select client_id, google_subject, owner_email, calendar_id,
      refresh_token_encrypted, connected_at from public.calendar_connections where id = 'darryl'`;
      return rows[0] || null;
    },
    async save(connection) {
      // Pin Google's stable subject after first consent; an email change/reassignment
      // must never silently connect a different Google account.
      const rows = await getSql()`insert into public.calendar_connections
      (id, client_id, google_subject, owner_email, calendar_id, refresh_token_encrypted)
      values ('darryl', ${connection.clientId}, ${connection.subject}, ${connection.email},
        ${connection.calendarId}, ${connection.refreshTokenEncrypted})
      on conflict (id) do update set client_id = excluded.client_id,
        owner_email = excluded.owner_email, calendar_id = excluded.calendar_id,
        refresh_token_encrypted = excluded.refresh_token_encrypted, connected_at = now()
      where public.calendar_connections.google_subject = excluded.google_subject
      returning id`;
      if (!rows.length) throw new Error('Calendar owner cannot be replaced');
    },
  };
}

export const calendarStore = createCalendarStore();

export async function calendarCredentials() {
  const stored = await calendarStore.read();
  if (stored) {
    if (
      stored.client_id !== process.env.GOOGLE_CLIENT_ID ||
      stored.owner_email !== process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase()
    )
      throw new Error('Calendar owner configuration has changed');
    return {
      calendarId: stored.calendar_id,
      refreshToken: unseal(stored.refresh_token_encrypted, 'refresh-token'),
    };
  }
  // Retain the local helper for development only. Hosted connections use the DB.
  if (
    process.env.NODE_ENV !== 'production' &&
    !process.env.VERCEL &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    return {
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    };
  }
  const error = new Error('Darryl has not connected Google Calendar');
  error.code = 'CALENDAR_NOT_CONNECTED';
  throw error;
}
