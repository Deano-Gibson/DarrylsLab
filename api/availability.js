import { admin } from '../server/platform.js';
import { busyIntervals, overlaps } from '../server/services/google-calendar.js';

export async function GET(request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return Response.json({ error: 'Sign in first' }, { status: 401 });
  try {
    const db = admin();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(bearer);
    if (authError || !user || user.is_anonymous)
      return Response.json({ error: 'Sign in first' }, { status: 401 });
    const { data: slots, error } = await db
      .from('training_slots')
      .select('id,starts_at,ends_at')
      .eq('available', true)
      .gt('starts_at', new Date(Date.now() + 12 * 3600000).toISOString())
      .lt('starts_at', new Date(Date.now() + 60 * 86400000).toISOString())
      .order('starts_at')
      .limit(100);
    if (error) throw error;
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
