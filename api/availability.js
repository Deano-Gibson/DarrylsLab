import { customer, db } from '../server/platform.js';
import { busyIntervals, overlaps } from '../server/services/google-calendar.js';

export async function GET(request) {
  if (!(await customer(request))) return Response.json({ error: 'Sign in first' }, { status: 401 });
  try {
    const earliest = new Date(Date.now() + 12 * 3600000).toISOString();
    const latest = new Date(Date.now() + 60 * 86400000).toISOString();
    const slots = await db()`select id, starts_at, ends_at from public.training_slots
      where available and starts_at > ${earliest} and starts_at < ${latest}
      order by starts_at limit 100`;
    if (!slots?.length) return Response.json({ slots: [] });
    const busy = await busyIntervals(slots[0].starts_at, slots.at(-1).ends_at);
    return Response.json(
      {
        slots: slots
          .filter((slot) => !overlaps(slot.starts_at, slot.ends_at, busy))
          .map(({ id, starts_at }) => ({ id, starts_at })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Calendar availability failed', error);
    return Response.json({ error: 'Availability is temporarily unavailable' }, { status: 503 });
  }
}
