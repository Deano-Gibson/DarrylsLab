import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
process.loadEnvFile('.env');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query('begin');
  const data = {
    name: 'Database verification',
    email: `${randomUUID()}@example.invalid`,
    phone: '',
    goals: 'Verification only',
    availability: 'Monday',
    message: '',
    mainGoal: 'Get stronger',
    experience: 'Beginner',
    screening: 'No',
    referral: 'Google',
    confirmation: true,
    termsVersion: 'enquiry-2026-09-28',
    consentVersion: 'intake-v2',
  };
  const id = randomUUID();
  const submit = (request, fingerprint = 'same') =>
    client.query('select public.submit_coaching_enquiry($1,$2,$3,$4,$5) as id', [
      request,
      fingerprint,
      JSON.stringify(data),
      'test-' + id,
      JSON.stringify({ coach: {}, customer: {} }),
    ]);
  const first = await submit(id);
  const stored = (await client.query('select intake,consent_version from public.coaching_enquiries where id=$1',[first.rows[0].id])).rows[0];
  assert.deepEqual(stored.intake, { mainGoal:data.mainGoal,experience:data.experience,screening:data.screening,referral:data.referral,confirmation:true,termsVersion:data.termsVersion });
  assert.equal(stored.consent_version,'intake-v2');
  assert.equal((await submit(id)).rows[0].id, first.rows[0].id);
  assert.equal(
    (
      await client.query(
        'select count(*)::int as count from public.enquiry_emails where enquiry_id=$1',
        [first.rows[0].id],
      )
    ).rows[0].count,
    2,
  );
  await client.query('savepoint conflict');
  await assert.rejects(submit(id, 'different'), /REQUEST_CONFLICT/);
  await client.query('rollback to savepoint conflict');
  await submit(randomUUID());
  await client.query('savepoint rate');
  await assert.rejects(submit(randomUUID()), /ENQUIRY_RATE_LIMIT/);
  await client.query('rollback to savepoint rate');
  const config = await client.query('select email_and_password from neon_auth.project_config');
  assert.equal(config.rows[0].email_and_password.disableSignUp, true);
  console.log(
    'Database checks passed: atomic outbox, idempotency, conflict, rate limit, signup disabled. Test records rolled back.',
  );
} finally {
  await client.query('rollback').catch(() => {});
  await client.end();
}
