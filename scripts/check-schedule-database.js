import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import pg from 'pg';
import { publishTrainingSlots, trainingSlots } from '../server/services/training-schedule.js';
loadEnvFile('.env');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
const sql = (strings, ...values) =>
  client
    .query(
      strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''),
      values,
    )
    .then((result) => result.rows);
try {
  await client.connect();
  await client.query('begin');
  await client.query("set local statement_timeout = '10s'");
  const now = new Date('2035-10-01T00:00:00Z');
  const slots = trainingSlots(now);
  await publishTrainingSlots(sql, now);
  assert.equal(
    await publishTrainingSlots(sql, now),
    0,
    'Repeated publication must not duplicate slots',
  );
  await client.query('update public.training_slots set available=false where starts_at=$1', [
    slots[0].starts_at,
  ]);
  await publishTrainingSlots(sql, now);
  const closed = await client.query(
    'select available from public.training_slots where starts_at=$1',
    [slots[0].starts_at],
  );
  assert.equal(closed.rows[0].available, false, 'Publication must preserve closed or booked slots');
  console.log(
    'Schedule publication, idempotency, and closed-slot preservation passed (rolled back).',
  );
} finally {
  await client.query('rollback').catch(() => {});
  await client.end();
}
