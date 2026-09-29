import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnquiryHandler, validateEnquiry } from '../server/services/enquiries.js';
import { hasClientAccess } from '../server/services/client-access.js';
const data = {
  requestId: 'f99397b0-355d-438f-b973-cd73a8b81981',
  name: 'Test Person',
  phone: '07123456789',
  mainGoal: 'Get stronger',
  experience: 'Beginner',
  screening: 'No',
  confirmation: true,
  email: 'person@example.com',
  goals: 'Get stronger',
  availability: 'Monday morning',
  consent: true,
};
test('enquiry validates consent and rejects email header injection', () => {
  assert.equal(validateEnquiry(data).email, 'person@example.com');
  assert.throws(() => validateEnquiry({ ...data, consent: false }));
  assert.throws(() =>
    validateEnquiry({ ...data, email: 'a@example.com\r\nBcc:other@example.com' }),
  );
  assert.throws(() => validateEnquiry({ ...data, message: 'x'.repeat(1201) }));
});
test('saved enquiry succeeds even when email is unavailable; origin and validation gate storage', async () => {
  process.env.GOOGLE_OWNER_EMAIL = 'coach@example.com';
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = 'test-only-key';
  let saved = 0;
  const handler = createEnquiryHandler({
    origin: () => 'https://example.com',
    getSql: () => async () => {
      saved++;
      return [{ id: 'test' }];
    },
    deliver: async () => false,
  });
  const request = (body, origin = 'https://example.com') =>
    new Request('https://example.com/api/enquiries', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await handler(request(data, 'https://other.com'))).status, 403);
  assert.equal((await handler(request({ ...data, consent: false }))).status, 400);
  assert.equal(saved, 0);
  assert.deepEqual(await (await handler(request(data))).json(), { ok: true, emailSent: false });
  assert.equal(saved, 1);
});
test('portal requires both verified identity and explicit active approval', async () => {
  const approved = async () => [{ user_id: 'id' }];
  assert.equal(await hasClientAccess({ id: 'id', emailVerified: false }, approved), false);
  assert.equal(await hasClientAccess({ id: 'id', emailVerified: true }, async () => []), false);
  assert.equal(await hasClientAccess({ id: 'id', emailVerified: true }, approved), true);
});

test('intake choices and required phone and confirmation are validated server-side', () => {
  for (const field of ['phone', 'mainGoal', 'experience', 'screening'])
    assert.throws(() => validateEnquiry({ ...data, [field]: '' }));
  assert.throws(() => validateEnquiry({ ...data, confirmation: false }));
  assert.throws(() => validateEnquiry({ ...data, experience: 'invented' }));
  const result = validateEnquiry({ ...data, availability: undefined, referral: 'Google' });
  assert.equal(result.referral, 'Google');
  assert.equal(result.termsVersion, 'enquiry-2026-09-28-v2');
  assert.equal(result.consentVersion, 'intake-v3');
});
