import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as checkout } from '../api/checkout.js';
import { POST as webhook } from '../api/stripe-webhook.js';
import { GET as availability } from '../api/availability.js';
import { POST as book } from '../api/book.js';
import { GET as account } from '../api/account.js';
import { packs } from '../server/platform.js';

test('pack prices are explicit server-side amounts in pence', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(packs).map(([id, pack]) => [id, pack.pence])),
    { one: 4500, two: 8000, eight: 25000 },
  );
});

test('private endpoints reject unsigned or anonymous requests', async () => {
  const base = 'http://localhost';
  const responses = await Promise.all([
    checkout(new Request(`${base}/api/checkout`, { method: 'POST' })),
    webhook(new Request(`${base}/api/stripe-webhook`, { method: 'POST' })),
    availability(new Request(`${base}/api/availability`)),
    book(new Request(`${base}/api/book`, { method: 'POST' })),
    account(new Request(`${base}/api/account`)),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status),
    [401, 400, 401, 401, 401],
  );
});
