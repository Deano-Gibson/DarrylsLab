import { admin } from '../server/platform.js';
import {
  busyIntervals,
  createTrainingEvent,
  overlaps,
} from '../server/services/google-calendar.js';

export async function POST(request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return Response.json({ error: 'Sign in first' }, { status: 401 });
  let bookingId;
  const db = admin();
  try {
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(bearer);
    if (authError || !user?.email || user.is_anonymous)
      return Response.json({ error: 'Sign in first' }, { status: 401 });
    const { slotId } = await request.json();
    if (typeof slotId !== 'string' || !/^[0-9a-f-]{36}$/i.test(slotId))
      return Response.json({ error: 'Invalid slot' }, { status: 400 });
    const { data: slot, error: slotError } = await db
      .from('training_slots')
      .select('id,starts_at,ends_at')
      .eq('id', slotId)
      .eq('available', true)
      .maybeSingle();
    if (slotError || !slot || new Date(slot.starts_at).getTime() < Date.now() + 12 * 3600000) {
      return Response.json({ error: 'That time is no longer available' }, { status: 409 });
    }
    if (overlaps(slot.starts_at, slot.ends_at, await busyIntervals(slot.starts_at, slot.ends_at))) {
      return Response.json(
        { error: 'Darryl is busy at that time. Please choose another.' },
        { status: 409 },
      );
    }
    const reserved = await db.rpc('reserve_training_slot', {
      p_slot_id: slot.id,
      p_user_id: user.id,
    });
    if (reserved.error)
      return Response.json(
        { error: 'That slot or credit balance changed. Please refresh and try again.' },
        { status: 409 },
      );
    bookingId = reserved.data;
    // Recheck external changes made between the initial free/busy query and reservation.
    if (overlaps(slot.starts_at, slot.ends_at, await busyIntervals(slot.starts_at, slot.ends_at))) {
      const rollback = await db.rpc('rollback_calendar_booking', { p_booking: bookingId });
      if (rollback.error) throw rollback.error;
      return Response.json(
        { error: 'Darryl is now busy at that time. Your credit was returned.' },
        { status: 409 },
      );
    }
    const eventId = await createTrainingEvent(bookingId, slot.starts_at, slot.ends_at, user.email);
    const confirmed = await db
      .from('session_bookings')
      .update({ calendar_status: 'confirmed', google_event_id: eventId })
      .eq('id', bookingId);
    if (confirmed.error) throw confirmed.error;
    return Response.json({ bookingId, status: 'confirmed' });
  } catch (error) {
    console.error('Calendar booking failed', bookingId, error);
    // A timeout or failed DB update may follow a successful Google insert.
    // Keep the reserved credit/slot pending for reconciliation; never refund it
    // while an appointment might exist on Darryl's calendar.
    return Response.json(
      {
        error: bookingId
          ? 'Booking is pending confirmation. Do not book again; contact Darryl if it stays pending.'
          : 'Calendar is temporarily unavailable. No credit was spent.',
        status: bookingId ? 'pending' : 'failed',
      },
      { status: bookingId ? 202 : 503 },
    );
  }
}
