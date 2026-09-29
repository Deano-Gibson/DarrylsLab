import { customer, db } from '../server/platform.js';
import { hasClientAccess, accessRequired } from '../server/services/client-access.js';
import { busyIntervals, overlaps } from '../server/services/google-calendar.js';
import { isWorkingSlot, publishTrainingSlots } from '../server/services/training-schedule.js';

export async function GET(request) {
  const user = await customer(request);
  if (!user) return Response.json({ error: 'Sign in first' }, { status: 401 });
  try {
    if (!(await hasClientAccess(user))) return accessRequired();
    await publishTrainingSlots(db());
    const earliest = new Date(Date.now() + 12 * 3600000).toISOString();
    const latest = new Date(Date.now() + 60 * 86400000).toISOString();
    const candidates = await db()`select id, starts_at, ends_at from public.training_slots
      where available and starts_at > ${earliest} and starts_at < ${latest}
      order by starts_at limit 1000`;
    const slots = candidates.filter((slot) => isWorkingSlot(slot.starts_at, slot.ends_at));
    if (!slots.length)
      return Response.json({ slots: [] }, { headers: { 'Cache-Control': 'no-store' } });
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
    if (error.code === 'CALENDAR_NOT_CONNECTED')
      return Response.json(
        {
          error: 'Booking will open once Darryl finishes connecting his calendar.',
          code: error.code,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    console.error('Calendar availability failed', error);
    return Response.json({ error: 'Availability is temporarily unavailable' }, { status: 503 });
  }
}
