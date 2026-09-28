// Opt-in integration checks against the configured branch. Every fixture is rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import pg from 'pg';

try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query('begin');
  await client.query("set local statement_timeout = '10s'");
  const user = randomUUID();
  await client.query(
    `insert into neon_auth."user" (id, name, email, "emailVerified")
      values ($1, 'Booking integration test', $2, false)`,
    [user, `booking-test-${user}@example.invalid`],
  );
  const slots = await client.query(`insert into public.training_slots(starts_at, ends_at)
    select now() + interval '40 days' + n * interval '2 hours',
      now() + interval '40 days' + n * interval '2 hours' + interval '1 hour'
    from generate_series(1, 3) n returning id`);
  const reserve = async (slot) =>
    (await client.query('select public.reserve_training_slot($1, $2) as id', [slot, user])).rows[0]
      .id;
  const rollback = async (id) =>
    (await client.query('select public.rollback_calendar_booking($1) as released', [id])).rows[0]
      .released;
  const balance = async () =>
    (await client.query('select credits from public.session_accounts where user_id = $1', [user]))
      .rows[0]?.credits;

  // A new account with no credit row can book. The same slot cannot be booked twice.
  const booking = await reserve(slots.rows[0].id);
  assert.ok(booking);
  assert.equal(await balance(), undefined);
  await client.query('savepoint duplicate_booking');
  await assert.rejects(reserve(slots.rows[0].id), /no longer available|already been booked/);
  await client.query('rollback to savepoint duplicate_booking');
  assert.equal(await rollback(booking), true);
  assert.equal(await rollback(booking), false);
  assert.equal(await balance(), undefined);

  // Explicit zero balance also works, and rollback never grants a free credit.
  await client.query('insert into public.session_accounts(user_id, credits) values ($1, 0)', [
    user,
  ]);
  const zeroBalanceBooking = await reserve(slots.rows[0].id);
  assert.equal(await balance(), 0);
  assert.equal(await rollback(zeroBalanceBooking), true);
  assert.equal(await balance(), 0);

  // Previously purchased credits are neither consumed nor increased by new bookings.
  await client.query('update public.session_accounts set credits = 4 where user_id = $1', [user]);
  const preservedBooking = await reserve(slots.rows[1].id);
  assert.equal(await balance(), 4);
  assert.equal(await rollback(preservedBooking), true);
  assert.equal(await balance(), 4);

  // A historical pending booking that spent a credit still receives its refund once.
  const legacy = await client.query(
    `insert into public.session_bookings(user_id, slot_id, credits_spent)
    values ($1, $2, 1) returning id`,
    [user, slots.rows[2].id],
  );
  await client.query('update public.training_slots set available = false where id = $1', [
    slots.rows[2].id,
  ]);
  assert.equal(await rollback(legacy.rows[0].id), true);
  assert.equal(await rollback(legacy.rows[0].id), false);
  assert.equal(await balance(), 5);

  // Confirmed reservations cannot be released by the pending-conflict path.
  const confirmed = await reserve(slots.rows[0].id);
  await client.query(
    "update public.session_bookings set calendar_status = 'confirmed' where id = $1",
    [confirmed],
  );
  assert.equal(await rollback(confirmed), false);
  console.log('Booking database checks passed; all test data will be rolled back.');
} finally {
  await client.query('rollback').catch(() => {});
  await client.end();
}
