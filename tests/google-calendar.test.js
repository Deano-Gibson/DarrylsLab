import test from 'node:test';
import assert from 'node:assert/strict';
import {
  busyIntervals,
  createTrainingEvent,
  overlaps,
} from '../server/services/google-calendar.js';
import { calendarStore } from '../server/services/calendar-store.js';
import { seal } from '../server/services/calendar-secrets.js';

test('calendar conflicts overlap a one-hour session', () => {
  const busy = [{ start: '2026-10-01T09:30:00Z', end: '2026-10-01T10:30:00Z' }];
  assert.equal(overlaps('2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z', busy), true);
  assert.equal(overlaps('2026-10-01T10:30:00Z', '2026-10-01T11:30:00Z', busy), false);
  assert.equal(overlaps('2026-10-01T08:30:00Z', '2026-10-01T09:30:00Z', busy), false);
});

test('bookings use the encrypted hosted connection and reconnects replace cached access', async (t) => {
  const keys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_OWNER_EMAIL',
    'CALENDAR_TOKEN_ENCRYPTION_KEY',
  ];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  });
  process.env.GOOGLE_CLIENT_ID = 'calendar-test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'calendar-test-secret';
  process.env.GOOGLE_OWNER_EMAIL = 'owner@example.com';
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
  let refreshToken = 'stored-token-one';
  t.mock.method(calendarStore, 'read', async () => ({
    client_id: process.env.GOOGLE_CLIENT_ID,
    owner_email: process.env.GOOGLE_OWNER_EMAIL,
    calendar_id: 'primary',
    refresh_token_encrypted: seal(refreshToken, 'refresh-token'),
  }));
  const refreshes = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/token')) {
      refreshes.push(options.body.get('refresh_token'));
      return Response.json({ access_token: `access-${refreshes.length}`, expires_in: 3600 });
    }
    assert.equal(options.headers.Authorization, `Bearer access-${refreshes.length}`);
    if (url.endsWith('/freeBusy')) return Response.json({ calendars: { primary: { busy: [] } } });
    assert.match(url, /\/calendars\/primary\/events\?sendUpdates=all$/);
    const event = JSON.parse(options.body);
    assert.equal(event.start.timeZone, 'Europe/London');
    return Response.json({ id: event.id });
  });
  assert.deepEqual(await busyIntervals('2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z'), []);
  assert.equal(
    await createTrainingEvent(
      'a'.repeat(32),
      '2026-10-01T09:00:00Z',
      '2026-10-01T10:00:00Z',
      'client@example.com',
    ),
    `dl${'a'.repeat(32)}`,
  );
  assert.deepEqual(refreshes, ['stored-token-one']);
  refreshToken = 'stored-token-two';
  await busyIntervals('2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z');
  assert.deepEqual(refreshes, ['stored-token-one', 'stored-token-two']);
});
