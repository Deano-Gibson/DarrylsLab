create table if not exists public.coaching_enquiries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  fingerprint text not null,
  name text not null,
  email text not null,
  phone text not null default '',
  goals text not null,
  availability text not null,
  message text not null default '',
  status text not null default 'new' check (status in ('new','contacted','call_arranged','approved','closed')),
  consent_version text not null default 'enquiry-v1',
  ip_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.coaching_enquiries add column if not exists intake jsonb not null default '{}'::jsonb;
create index if not exists coaching_enquiries_created on public.coaching_enquiries(created_at);
create table if not exists public.enquiry_emails (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.coaching_enquiries(id) on delete cascade,
  kind text not null check (kind in ('customer','coach')),
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed','uncertain')),
  attempted_at timestamptz,
  sent_at timestamptz,
  unique(enquiry_id, kind)
);
create table if not exists public.client_access (
  user_id uuid primary key references neon_auth."user"(id),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.coaching_enquiries enable row level security;
alter table public.enquiry_emails enable row level security;
alter table public.client_access enable row level security;
revoke all on public.coaching_enquiries, public.enquiry_emails, public.client_access from public;

create or replace function public.submit_coaching_enquiry(p_request uuid, p_fingerprint text, p_data jsonb, p_ip text, p_mail jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_fingerprint text;
begin
  -- Serialise submission checks so concurrent requests cannot bypass limits or duplicate mail.
  perform pg_advisory_xact_lock(782164091);
  select id, fingerprint into v_id, v_fingerprint from public.coaching_enquiries where request_id=p_request;
  if found then
    if v_fingerprint <> p_fingerprint then raise exception 'REQUEST_CONFLICT'; end if;
    return v_id;
  end if;
  if (select count(*) from public.coaching_enquiries where created_at > now()-interval '1 day') >= 100
    or (select count(*) from public.coaching_enquiries where email=p_data->>'email' and created_at > now()-interval '1 day') >= 2
    or (select count(*) from public.coaching_enquiries where ip_hash=p_ip and created_at > now()-interval '1 hour') >= 5
  then raise exception 'ENQUIRY_RATE_LIMIT'; end if;
  insert into public.coaching_enquiries(request_id,fingerprint,name,email,phone,goals,availability,message,ip_hash,intake,consent_version)
    values(p_request,p_fingerprint,p_data->>'name',p_data->>'email',p_data->>'phone',p_data->>'goals',p_data->>'availability',p_data->>'message',p_ip,jsonb_build_object('mainGoal',p_data->>'mainGoal','experience',p_data->>'experience','screening',p_data->>'screening','referral',p_data->>'referral','confirmation',p_data->'confirmation','termsVersion',p_data->>'termsVersion'),coalesce(p_data->>'consentVersion','enquiry-v1'))
    returning id into v_id;
  insert into public.enquiry_emails(enquiry_id,kind,payload)
    select v_id, key, value from jsonb_each(p_mail);
  return v_id;
end;
$$;
revoke all on function public.submit_coaching_enquiry(uuid,text,jsonb,text,jsonb) from public;
