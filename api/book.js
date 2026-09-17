import { customer, db } from '../server/platform.js';
import {
  busyIntervals,
  createTrainingEvent,
  overlaps,
} from '../server/services/google-calendar.js';

export async function POST(request) {
  const user = await customer(request);
  if (!user) return Response.json({ error: 'Sign in first' }, { status: 401 });
  let bookingId;
  try {
    const { slotId } = await request.json();
    if (typeof slotId !== 'string' || !/^[0-9a-f-]{36}$/i.test(slotId))
      return Response.json({ error: 'Invalid slot' }, { status: 400 });
    const [slot] = await db()`select id, starts_at, ends_at from public.training_slots
      where id = ${slotId}::uuid and available limit 1`;
    if (!slot || new Date(slot.starts_at).getTime() < Date.now() + 12 * 3600000) {
      return Response.json({ error: 'That time is no longer available' }, { status: 409 });
    }
    if (overlaps(slot.starts_at, slot.ends_at, await busyIntervals(slot.starts_at, slot.ends_at))) {
      return Response.json(
        { error: 'Darryl is busy at that time. Please choose another.' },
        { status: 409 },
      );
    }
    let reserved;
    try {
      reserved =
        await db()`select public.reserve_training_slot(${slot.id}::uuid, ${user.id}::uuid) as id`;
    } catch {
      return Response.json(
        { error: 'That slot or credit balance changed. Please refresh and try again.' },
        { status: 409 },
      );
    }
    bookingId = reserved[0].id;
    // Recheck external changes made between the initial free/busy query and reservation.
    if (overlaps(slot.starts_at, slot.ends_at, await busyIntervals(slot.starts_at, slot.ends_at))) {
      const rollback =
        await db()`select public.rollback_calendar_booking(${bookingId}::uuid) as returned`;
      if (!rollback[0]?.returned) throw new Error('Reserved credit could not be restored');
      return Response.json(
        { error: 'Darryl is now busy at that time. Your credit was returned.' },
        { status: 409 },
      );
    }
    const eventId = await createTrainingEvent(bookingId, slot.starts_at, slot.ends_at, user.email);
    const updated = await db()`update public.session_bookings set calendar_status = 'confirmed',
      google_event_id = ${eventId} where id = ${bookingId}::uuid and calendar_status = 'pending'
      returning id`;
    if (!updated.length) throw new Error('Calendar event exists but booking confirmation failed');
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
