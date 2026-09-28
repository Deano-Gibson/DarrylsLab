const HOUR = 3600000;
export const BOOKING_WINDOW_DAYS = 60;
const ukParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isWorkingSlot(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (
    !Number.isFinite(start.getTime()) ||
    end - start !== HOUR ||
    start.getUTCSeconds() ||
    start.getUTCMilliseconds()
  )
    return false;
  const parts = Object.fromEntries(
    ukParts.formatToParts(start).map(({ type, value }) => [type, value]),
  );
  const hour = Number(parts.hour);
  return (
    parts.minute === '00' &&
    hour >= 6 &&
    hour < 18 &&
    !(parts.weekday === 'Tue' && hour >= 13) &&
    !(parts.weekday === 'Thu' && hour >= 8 && hour < 13)
  );
}

export function trainingSlots(now = new Date()) {
  const earliest = now.getTime() + 12 * HOUR;
  const latest = now.getTime() + BOOKING_WINDOW_DAYS * 24 * HOUR;
  const slots = [];
  // Walk UTC hours and test UK wall time, so BST/GMT transitions need no guessed offset.
  for (let start = Math.floor(earliest / HOUR) * HOUR + HOUR; start < latest; start += HOUR) {
    const starts_at = new Date(start).toISOString();
    const ends_at = new Date(start + HOUR).toISOString();
    if (isWorkingSlot(starts_at, ends_at)) slots.push({ starts_at, ends_at });
  }
  return slots;
}

export async function publishTrainingSlots(sql, now = new Date()) {
  const slots = trainingSlots(now);
  // Existing rows, including booked and manually closed slots, remain untouched.
  const rows = await sql`insert into public.training_slots (starts_at, ends_at)
    select starts_at, ends_at from jsonb_to_recordset(${JSON.stringify(slots)}::jsonb)
      as candidates(starts_at timestamptz, ends_at timestamptz)
    on conflict (starts_at) do nothing returning id`;
  return rows.length;
}
