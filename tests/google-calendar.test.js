import test from 'node:test';
import assert from 'node:assert/strict';
import { overlaps } from '../server/services/google-calendar.js';

test('calendar conflicts overlap a one-hour session', () => {
  const busy = [{ start: '2026-10-01T09:30:00Z', end: '2026-10-01T10:30:00Z' }];
  assert.equal(overlaps('2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z', busy), true);
  assert.equal(overlaps('2026-10-01T10:30:00Z', '2026-10-01T11:30:00Z', busy), false);
  assert.equal(overlaps('2026-10-01T08:30:00Z', '2026-10-01T09:30:00Z', busy), false);
});
