// Opt-in checks of the real storage queries. All fixtures are transactionally rolled back.
import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createCalendarStore } from '../server/services/calendar-store.js';
import { digest, randomToken, seal, unseal } from '../server/services/calendar-secrets.js';

loadEnvFile('.env');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
// Adapt pg's transaction-bound client to Neon's tagged-query shape.
const sql = (strings, ...values) =>
  client
    .query(
      strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''),
      values,
    )
    .then((result) => result.rows);
sql.transaction = (queries) => Promise.all(queries);
const store = createCalendarStore(() => sql);
try {
  await client.connect();
  await client.query('begin');
  await client.query("set local statement_timeout = '10s'");
  assert.equal(await store.read(), null, 'Run this check on a branch with no connected calendar');
  const key = randomBytes(32);
  const attempt = {
    stateHash: digest(randomToken()),
    browserHash: digest(randomToken()),
    verifierEncrypted: seal(randomToken(), 'pkce', key),
    nonce: randomToken(),
  };
  await store.begin(attempt);
  assert.equal(await store.consume(attempt.stateHash, digest('wrong-browser')), undefined);
  assert.deepEqual(await store.consume(attempt.stateHash, attempt.browserHash), {
    verifier_encrypted: attempt.verifierEncrypted,
    nonce: attempt.nonce,
  });
  assert.equal(await store.consume(attempt.stateHash, attempt.browserHash), undefined);
  await store.begin(attempt);
  await client.query(
    "update public.calendar_oauth_attempts set expires_at = now() - interval '1 second' where state_hash = $1",
    [attempt.stateHash],
  );
  assert.equal(await store.consume(attempt.stateHash, attempt.browserHash), undefined);
  // Starting again in the same browser invalidates its old attempt.
  await store.begin(attempt);
  const replacement = { ...attempt, stateHash: digest(randomToken()) };
  await store.begin(replacement);
  assert.equal(await store.consume(attempt.stateHash, attempt.browserHash), undefined);
  assert.ok(await store.consume(replacement.stateHash, replacement.browserHash));

  const connection = {
    clientId: 'integration-test',
    subject: 'test-owner',
    email: 'coach@example.invalid',
    calendarId: 'primary',
    refreshTokenEncrypted: seal('test-refresh-token', 'refresh-token', key),
  };
  await store.save(connection);
  const saved = await store.read();
  assert.equal(unseal(saved.refresh_token_encrypted, 'refresh-token', key), 'test-refresh-token');
  await assert.rejects(
    store.save({ ...connection, subject: 'different-google-user' }),
    /owner cannot be replaced/,
  );
  assert.equal((await store.read()).google_subject, 'test-owner');
  await store.save({
    ...connection,
    refreshTokenEncrypted: seal('replacement-token', 'refresh-token', key),
  });
  assert.equal(
    unseal((await store.read()).refresh_token_encrypted, 'refresh-token', key),
    'replacement-token',
  );
  const tables = await client.query(`select relname, relrowsecurity from pg_class
    where oid in ('public.calendar_connections'::regclass, 'public.calendar_oauth_attempts'::regclass)`);
  assert.equal(tables.rows.length, 2);
  assert.ok(tables.rows.every((table) => table.relrowsecurity));
  const policies = await client.query(`select count(*)::int as count from pg_policies
    where schemaname = 'public' and tablename in ('calendar_connections', 'calendar_oauth_attempts')`);
  assert.equal(policies.rows[0].count, 0);
  console.log('Calendar storage checks passed; all test data will be rolled back.');
} finally {
  await client.query('rollback').catch(() => {});
  await client.end();
}
