-- Run once in the Supabase SQL editor. Review before applying to an existing project.
create table if not exists public.session_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.training_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  available boolean not null default true,
  constraint one_hour_slot check (ends_at = starts_at + interval '1 hour')
);
create table if not exists public.session_purchases (
  stripe_session_id text primary key,
  user_id uuid not null references auth.users(id),
  pack text not null check (pack in ('one', 'two', 'eight')),
  credits integer not null check (credits in (1, 2, 8)),
  created_at timestamptz not null default now()
);
create table if not exists public.session_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  slot_id uuid not null unique references public.training_slots(id),
  calendar_status text not null default 'pending' check (calendar_status in ('pending', 'confirmed')),
  google_event_id text unique,
  created_at timestamptz not null default now()
);
-- Allows upgrading a database created from the earlier credit-only schema.
alter table public.session_bookings add column if not exists calendar_status text not null default 'pending'
  check (calendar_status in ('pending', 'confirmed'));
alter table public.session_bookings add column if not exists google_event_id text unique;
create index if not exists session_bookings_user_idx on public.session_bookings(user_id);
create index if not exists training_slots_starts_idx on public.training_slots(starts_at);

alter table public.session_accounts enable row level security;
alter table public.training_slots enable row level security;
alter table public.session_purchases enable row level security;
alter table public.session_bookings enable row level security;
revoke all on public.session_accounts, public.training_slots, public.session_purchases, public.session_bookings from anon, authenticated;
grant select on public.session_accounts, public.session_purchases, public.session_bookings to authenticated;
grant select on public.training_slots to authenticated;

drop policy if exists "read own balance" on public.session_accounts;
drop policy if exists "read own purchases" on public.session_purchases;
drop policy if exists "read own bookings" on public.session_bookings;
drop policy if exists "read future slots" on public.training_slots;
drop policy if exists "read available or own booked slots" on public.training_slots;
create policy "read own balance" on public.session_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own purchases" on public.session_purchases for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own bookings" on public.session_bookings for select to authenticated using ((select auth.uid()) = user_id);
create policy "read available or own booked slots" on public.training_slots for select to authenticated
  using ((available and starts_at > now()) or exists (
    select 1 from public.session_bookings b where b.slot_id = public.training_slots.id and b.user_id = (select auth.uid())
  ));

-- Server-only operation after validating the customer's token and live calendar.
-- It locks slot and balance in one transaction. No browser role may execute it.
drop function if exists public.book_training_slot(uuid);
create or replace function public.reserve_training_slot(p_slot_id uuid, p_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_balance integer;
  v_booking uuid;
begin
  if p_user_id is null then raise exception 'Missing customer'; end if;
  select starts_at into v_start from public.training_slots
    where id = p_slot_id and available for update;
  if v_start is null or v_start < now() + interval '12 hours' then
    raise exception 'This slot is no longer available';
  end if;
  insert into public.session_accounts(user_id) values (p_user_id) on conflict do nothing;
  select credits into v_balance from public.session_accounts where user_id = p_user_id for update;
  if v_balance < 1 then raise exception 'You need a session credit to book'; end if;
  if exists (select 1 from public.session_bookings where slot_id = p_slot_id) then
    raise exception 'This slot has already been booked';
  end if;
  insert into public.session_bookings(user_id, slot_id) values (p_user_id, p_slot_id) returning id into v_booking;
  update public.training_slots set available = false where id = p_slot_id;
  update public.session_accounts set credits = credits - 1 where user_id = p_user_id;
  return v_booking;
end;
$$;
revoke all on function public.reserve_training_slot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_training_slot(uuid, uuid) to service_role;

create or replace function public.rollback_calendar_booking(p_booking uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_slot uuid;
begin
  select user_id, slot_id into v_user, v_slot from public.session_bookings
    where id = p_booking and calendar_status = 'pending' for update;
  if v_user is null then return false; end if;
  delete from public.session_bookings where id = p_booking;
  update public.training_slots set available = true where id = v_slot;
  update public.session_accounts set credits = credits + 1 where user_id = v_user;
  return true;
end;
$$;
revoke all on function public.rollback_calendar_booking(uuid) from public, anon, authenticated;
grant execute on function public.rollback_calendar_booking(uuid) to service_role;

-- Called only by the server after Stripe signature/payment verification.
-- The unique checkout session makes webhook retries harmless.
create or replace function public.credit_paid_pack(p_session text, p_user uuid, p_pack text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_count integer;
begin
  v_count := case p_pack when 'one' then 1 when 'two' then 2 when 'eight' then 8 else null end;
  if v_count is null then raise exception 'Unknown pack'; end if;
  insert into public.session_purchases(stripe_session_id, user_id, pack, credits)
    values (p_session, p_user, p_pack, v_count) on conflict do nothing;
  if not found then return false; end if;
  insert into public.session_accounts(user_id, credits) values (p_user, v_count)
    on conflict (user_id) do update set credits = public.session_accounts.credits + excluded.credits;
  return true;
end;
$$;
revoke all on function public.credit_paid_pack(text, uuid, text) from public, anon, authenticated;
grant execute on function public.credit_paid_pack(text, uuid, text) to service_role;

-- Darryl publishes slots explicitly, in Europe/London local time, e.g.:
-- insert into public.training_slots(starts_at, ends_at)
-- values ('2026-10-01 10:00 Europe/London'::timestamptz,
--         '2026-10-01 11:00 Europe/London'::timestamptz);
