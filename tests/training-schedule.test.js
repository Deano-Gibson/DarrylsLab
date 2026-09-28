import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkingSlot, trainingSlots } from '../server/services/training-schedule.js';

test('UK hours include 6am to 5pm starts and exclude the Tuesday/Thursday blocks', () => {
  const valid = (value) =>
    isWorkingSlot(value, new Date(Date.parse(value) + 3600000).toISOString());
  assert.equal(valid('2026-09-28T05:00:00Z'), true); // Monday 6am BST
  assert.equal(valid('2026-09-28T16:00:00Z'), true); // Monday 5pm BST
  assert.equal(valid('2026-09-28T17:00:00Z'), false);
  assert.equal(valid('2026-09-29T11:00:00Z'), true); // Tuesday noon
  assert.equal(valid('2026-09-29T12:00:00Z'), false); // Tuesday 1pm
  assert.equal(valid('2026-10-01T06:00:00Z'), true); // Thursday 7am
  assert.equal(valid('2026-10-01T07:00:00Z'), false); // Thursday 8am
  assert.equal(valid('2026-10-01T11:00:00Z'), false); // Thursday noon
  assert.equal(valid('2026-10-01T12:00:00Z'), true); // Thursday 1pm
  assert.equal(valid('2026-09-28T05:30:00Z'), false);
  assert.equal(isWorkingSlot('invalid', 'invalid'), false);
});

test('rolling slots retain UK wall time across both daylight-saving transitions', () => {
  for (const [now, before, after] of [
    ['2026-10-23T00:00:00Z', '2026-10-24T05:00:00.000Z', '2026-10-25T06:00:00.000Z'],
    ['2027-03-26T00:00:00Z', '2027-03-27T06:00:00.000Z', '2027-03-28T05:00:00.000Z'],
  ]) {
    const slots = trainingSlots(new Date(now));
    assert.ok(slots.some((s) => s.starts_at === before));
    assert.ok(slots.some((s) => s.starts_at === after));
    assert.equal(new Set(slots.map((s) => s.starts_at)).size, slots.length);
    for (const slot of slots) {
      assert.ok(Date.parse(slot.starts_at) > Date.parse(now) + 12 * 3600000);
      assert.ok(Date.parse(slot.starts_at) < Date.parse(now) + 60 * 86400000);
      assert.ok(isWorkingSlot(slot.starts_at, slot.ends_at));
    }
  }
});
