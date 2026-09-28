import { calendarCredentials } from './calendar-store.js';
import { digest } from './calendar-secrets.js';

const API = 'https://www.googleapis.com/calendar/v3';
let tokenCache;

async function settings() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Calendar configuration is missing');
  }
  const { refreshToken, calendarId } = await calendarCredentials();
  return {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: refreshToken,
    GOOGLE_CALENDAR_ID: calendarId,
  };
}

async function accessToken(config) {
  const fingerprint = digest(`${config.GOOGLE_CLIENT_ID}:${config.GOOGLE_REFRESH_TOKEN}`);
  if (tokenCache?.fingerprint === fingerprint && Date.now() < tokenCache.expires)
    return tokenCache.value;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      refresh_token: config.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Google token refresh failed (${response.status})`);
  const result = await response.json();
  if (!result.access_token || !Number.isFinite(result.expires_in))
    throw new Error('Google did not return a valid access token');
  tokenCache = {
    fingerprint,
    value: result.access_token,
    expires: Date.now() + Math.max(30, result.expires_in - 120) * 1000,
  };
  return tokenCache.value;
}

async function calendarRequest(config, path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${await accessToken(config)}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) tokenCache = undefined;
    const error = new Error(`Google Calendar returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function busyIntervals(start, end) {
  const config = await settings();
  const { GOOGLE_CALENDAR_ID } = config;
  const result = await calendarRequest(config, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: start,
      timeMax: end,
      timeZone: 'Europe/London',
      items: [{ id: GOOGLE_CALENDAR_ID }],
    }),
  });
  const calendar = result.calendars?.[GOOGLE_CALENDAR_ID];
  if (!calendar || calendar.errors?.length)
    throw new Error('Google Calendar availability cannot be verified');
  return calendar.busy || [];
}

export function overlaps(start, end, intervals) {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  return intervals.some(
    (period) => from < new Date(period.end).getTime() && to > new Date(period.start).getTime(),
  );
}

export async function createTrainingEvent(bookingId, start, end, email) {
  const config = await settings();
  const { GOOGLE_CALENDAR_ID } = config;
  const eventId = `dl${bookingId.replaceAll('-', '')}`;
  const path = `/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`;
  try {
    const event = await calendarRequest(config, `${path}?sendUpdates=all`, {
      method: 'POST',
      body: JSON.stringify({
        id: eventId,
        summary: 'Personal training · DL Coaching',
        description:
          'One-hour personal training session with Darryl. Contact Darryl directly to discuss changes.',
        start: { dateTime: start, timeZone: 'Europe/London' },
        end: { dateTime: end, timeZone: 'Europe/London' },
        attendees: [{ email }],
        guestsCanInviteOthers: false,
        extendedProperties: { private: { bookingId } },
      }),
    });
    return event.id;
  } catch (error) {
    // An uncertain network response can mean Google created the event. The
    // deterministic ID lets us safely recognize a retry rather than duplicating it.
    if (error.status === 409) {
      const event = await calendarRequest(config, `${path}/${eventId}`);
      if (event.extendedProperties?.private?.bookingId === bookingId) return event.id;
    }
    throw error;
  }
}
