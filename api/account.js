import { customer, db } from '../server/platform.js';

export async function GET(request) {
  const user = await customer(request);
  if (!user) return Response.json({ error: 'Sign in first' }, { status: 401 });
  try {
    const [balances, bookings] = await Promise.all([
      db()`select credits from public.session_accounts where user_id = ${user.id} limit 1`,
      db()`select b.id, b.calendar_status, s.starts_at from public.session_bookings b
        join public.training_slots s on s.id = b.slot_id
        where b.user_id = ${user.id} order by b.created_at desc limit 30`,
    ]);
    return Response.json(
      { email: user.email, credits: balances[0]?.credits ?? 0, bookings },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Account load failed', error);
    return Response.json({ error: 'Account is temporarily unavailable' }, { status: 503 });
  }
}
