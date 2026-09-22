-- Neon Postgres setup. Apply with `npm run db:setup` after inspecting this file.
-- Browser clients never receive DATABASE_URL; all writes pass through server routes.
create table if not exists public.session_accounts (
  user_id uuid primary key references neon_auth."user"(id),
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
  user_id uuid not null references neon_auth."user"(id),
  pack text not null check (pack in ('one', 'two', 'four', 'eight', 'sixteen')),
  credits integer not null check (credits in (1, 2, 4, 8, 16)),
  created_at timestamptz not null default now()
);
create table if not exists public.session_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id),
  slot_id uuid not null unique references public.training_slots(id),
  calendar_status text not null default 'pending' check (calendar_status in ('pending', 'confirmed')),
  google_event_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists session_bookings_user_idx on public.session_bookings(user_id, created_at desc);
create index if not exists training_slots_available_starts_idx on public.training_slots(starts_at) where available;

-- Expand existing installations too; retain the retired two-session pack for purchase history.
alter table public.session_purchases drop constraint if exists session_purchases_pack_check;
alter table public.session_purchases add constraint session_purchases_pack_check
  check (pack in ('one', 'two', 'four', 'eight', 'sixteen'));
alter table public.session_purchases drop constraint if exists session_purchases_credits_check;
alter table public.session_purchases add constraint session_purchases_credits_check
  check (credits in (1, 2, 4, 8, 16));

-- Safe conversion of the short-lived text-id setup if it was already applied.
alter table public.session_accounts alter column user_id type uuid using user_id::uuid;
alter table public.session_purchases alter column user_id type uuid using user_id::uuid;
alter table public.session_bookings alter column user_id type uuid using user_id::uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'session_accounts_user_fk') then
    alter table public.session_accounts add constraint session_accounts_user_fk
      foreign key (user_id) references neon_auth."user"(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'session_purchases_user_fk') then
    alter table public.session_purchases add constraint session_purchases_user_fk
      foreign key (user_id) references neon_auth."user"(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'session_bookings_user_fk') then
    alter table public.session_bookings add constraint session_bookings_user_fk
      foreign key (user_id) references neon_auth."user"(id);
  end if;
end;
$$;

revoke all on public.session_accounts, public.session_purchases, public.session_bookings,
  public.training_slots from public;

create or replace function public.credit_paid_pack(p_session text, p_user uuid, p_pack text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  v_count := case p_pack when 'one' then 1 when 'two' then 2 when 'four' then 4
    when 'eight' then 8 when 'sixteen' then 16 else null end;
  if p_session is null or p_user is null or v_count is null then raise exception 'Invalid purchase'; end if;
  insert into public.session_purchases(stripe_session_id, user_id, pack, credits)
    values (p_session, p_user, p_pack, v_count) on conflict do nothing;
  if not found then return false; end if;
  insert into public.session_accounts(user_id, credits) values (p_user, v_count)
    on conflict (user_id) do update set credits = public.session_accounts.credits + excluded.credits;
  return true;
end;
$$;

create or replace function public.reserve_training_slot(p_slot_id uuid, p_user_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_start timestamptz; v_balance integer; v_booking uuid;
begin
  if p_user_id is null then raise exception 'Missing customer'; end if;
  select starts_at into v_start from public.training_slots where id = p_slot_id and available for update;
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

create or replace function public.rollback_calendar_booking(p_booking uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
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

revoke all on function public.credit_paid_pack(text, uuid, text),
  public.reserve_training_slot(uuid, uuid), public.rollback_calendar_booking(uuid) from public;
drop function if exists public.credit_paid_pack(text, text, text);
drop function if exists public.reserve_training_slot(uuid, text);

-- Example candidate hour, in UK local time. Google Calendar may still block it.
-- insert into public.training_slots(starts_at, ends_at)
-- values ('2026-10-01 10:00 Europe/London', '2026-10-01 11:00 Europe/London');
