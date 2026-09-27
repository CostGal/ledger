-- Per-entry reminders delivered as Web Push notifications.
-- Applied to the SANDBOX project only for now (reminders are Kostas-only
-- while they're being tried out). Secrets (VAPID keys, cron secret) live in
-- Supabase Vault and are NOT in this file — see supabase/README.md.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- One row per device that has said yes to notifications.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push_subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One row per reminder. An entry can have several (e.g. morning + evening).
--   freq 'daily'    -> every day
--   freq 'weekdays' -> only on the ISO weekdays in `weekdays` (1 = Mon … 7 = Sun)
--   freq 'every_n'  -> every `every_n` days counting from `start_date`
-- `tz` is the phone's IANA time zone when the reminder was saved, so
-- "21:00" means 21:00 where Kostas is, not UTC.
create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  entry_type_id uuid not null references public.entry_types(id) on delete cascade,
  at_time       time not null,
  freq          text not null default 'daily' check (freq in ('daily','weekdays','every_n')),
  weekdays      int[] not null default '{}',
  every_n       int not null default 1 check (every_n between 1 and 365),
  start_date    date not null default current_date,
  tz            text not null default 'UTC',
  enabled       boolean not null default true,
  last_sent_on  date,
  created_at    timestamptz not null default now()
);
alter table public.reminders enable row level security;
create policy "own reminders" on public.reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Called by the send-reminders edge function every 5 minutes. Atomically
-- marks each reminder that is due right now (within 30 min after its time,
-- local to its tz, not yet handled today) and returns it with the counts
-- needed to decide "already done, skip it".
create or replace function public.claim_due_reminders()
returns table (
  reminder_id uuid, user_id uuid, entry_name text, entry_icon text,
  kind text, period text, target int, today_count int, period_count int
)
language sql security definer set search_path = public as $$
  with upd as (
    update reminders r
       set last_sent_on = (now() at time zone r.tz)::date
     where r.enabled
       and (r.last_sent_on is null or r.last_sent_on < (now() at time zone r.tz)::date)
       and (now() at time zone r.tz) - ((now() at time zone r.tz)::date + r.at_time)
           between interval '0' and interval '30 minutes'
       and case r.freq
             when 'daily'    then true
             when 'weekdays' then extract(isodow from (now() at time zone r.tz))::int = any (r.weekdays)
             else (now() at time zone r.tz)::date >= r.start_date
                  and ((now() at time zone r.tz)::date - r.start_date) % r.every_n = 0
           end
    returning r.id, r.user_id, r.entry_type_id, (now() at time zone r.tz)::date as d
  ), span as (
    select u.*, e.name, e.icon, e.kind, e.period, e.target,
           case e.period when 'day' then u.d
                         when 'week' then u.d - (extract(isodow from u.d)::int - 1)
                         else date_trunc('month', u.d)::date end as ps,
           case e.period when 'day' then u.d
                         when 'week' then u.d - (extract(isodow from u.d)::int - 1) + 6
                         else (date_trunc('month', u.d) + interval '1 month - 1 day')::date end as pe
      from upd u join entry_types e on e.id = u.entry_type_id
     where e.active
  )
  select s.id, s.user_id, s.name, s.icon, s.kind, s.period, s.target,
         coalesce((select sum(l.count) from logs l where l.entry_type_id = s.entry_type_id and l.date = s.d), 0)::int,
         coalesce((select sum(l.count) from logs l where l.entry_type_id = s.entry_type_id and l.date between s.ps and s.pe), 0)::int
    from span s;
$$;
revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;

-- Hands the edge function its secrets from Vault. Service role only.
create or replace function public.reminder_secrets()
returns json
language sql security definer set search_path = public as $$
  select json_object_agg(name, decrypted_secret)
    from vault.decrypted_secrets
   where name in ('ledger_vapid_public','ledger_vapid_private','ledger_cron_secret');
$$;
revoke all on function public.reminder_secrets() from public, anon, authenticated;
grant execute on function public.reminder_secrets() to service_role;
