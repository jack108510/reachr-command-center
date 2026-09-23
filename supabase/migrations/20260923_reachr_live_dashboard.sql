-- Live Reachr dashboard and CRM. Apply after the private inbox migration.
alter table public.reachr_messages
  add column if not exists reply_classification text not null default 'unclassified';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reachr_reply_classification_check' and conrelid = 'public.reachr_messages'::regclass) then
    alter table public.reachr_messages add constraint reachr_reply_classification_check
      check (reply_classification in ('unclassified','positive','neutral','negative'));
  end if;
end $$;

create table if not exists public.reachr_contacts (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  recipient_name text,
  messenger_url text not null unique,
  email text,
  stage text not null default 'prospect'
    check (stage in ('prospect','interested','email_provided','waiting','closed_declined','client')),
  evidence text not null,
  note text not null default '',
  email_source text not null default 'none'
    check (email_source in ('none','prospect_provided_in_messenger')),
  source text not null default 'operator_verified_exact_messenger_thread',
  consent_status text not null default 'unknown',
  no_send boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reachr_contact_email_source_check check (
    (email is null and email_source = 'none') or
    (email is not null and email_source = 'prospect_provided_in_messenger')
  ),
  constraint reachr_contact_stage_email_check check (stage <> 'email_provided' or email is not null)
);
create table if not exists public.reachr_contact_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.reachr_contacts(id) on delete cascade,
  type text not null,
  summary text not null,
  source text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create or replace function public.reachr_contact_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.reachr_contact_events(contact_id,type,summary,source,created_by)
      values(new.id,'created',new.evidence,new.source,new.created_by);
    return new;
  end if;
  if new.stage is distinct from old.stage or new.note is distinct from old.note then
    insert into public.reachr_contact_events(contact_id,type,summary,source,created_by)
      values(new.id,'updated',
        concat_ws(' | ',
          case when new.stage is distinct from old.stage then 'stage: ' || old.stage || ' -> ' || new.stage end,
          case when new.note is distinct from old.note then 'note updated' end
        ),
        'operator_update',auth.uid());
  end if;
  new.updated_at = now();
  return new;
end $$;
revoke all on function public.reachr_contact_audit() from public, anon, authenticated;
drop trigger if exists reachr_contact_audit_insert on public.reachr_contacts;
drop trigger if exists reachr_contact_audit_update on public.reachr_contacts;
create trigger reachr_contact_audit_insert after insert on public.reachr_contacts
  for each row execute function public.reachr_contact_audit();
create trigger reachr_contact_audit_update before update on public.reachr_contacts
  for each row execute function public.reachr_contact_audit();

alter table public.reachr_contacts enable row level security;
alter table public.reachr_contact_events enable row level security;
revoke all on public.reachr_contacts, public.reachr_contact_events from public, anon, authenticated;
grant select, insert on public.reachr_contacts to authenticated;
grant update (stage,note) on public.reachr_contacts to authenticated;
grant select on public.reachr_contact_events to authenticated;
grant all on public.reachr_contacts, public.reachr_contact_events to service_role;

drop policy if exists "Reachr operator reads contacts" on public.reachr_contacts;
drop policy if exists "Reachr operator adds contacts" on public.reachr_contacts;
drop policy if exists "Reachr operator updates contacts" on public.reachr_contacts;
drop policy if exists "Reachr operator reads contact events" on public.reachr_contact_events;
create policy "Reachr operator reads contacts" on public.reachr_contacts
  for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com');
create policy "Reachr operator adds contacts" on public.reachr_contacts
  for insert to authenticated with check (
    (auth.jwt()->>'email') = 'wildejack1010@gmail.com' and created_by = auth.uid()
  );
create policy "Reachr operator updates contacts" on public.reachr_contacts
  for update to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com')
  with check ((auth.jwt()->>'email') = 'wildejack1010@gmail.com');
create policy "Reachr operator reads contact events" on public.reachr_contact_events
  for select to authenticated using (
    (auth.jwt()->>'email') = 'wildejack1010@gmail.com' and
    exists (select 1 from public.reachr_contacts c where c.id = contact_id)
  );

create or replace function public.reachr_dashboard_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
with local_day as (
  select (now() at time zone 'America/Edmonton')::date as today
), days as (
  select gs::date as day from local_day,
    generate_series((today - 13)::timestamp, today::timestamp, interval '1 day') as gs
), daily_counts as (
  select (m.observed_at at time zone 'America/Edmonton')::date as day,
    count(*) filter (where m.direction = 'outbound') as sent,
    count(*) filter (where m.direction = 'inbound') as replies,
    count(*) filter (where m.direction = 'inbound' and m.reply_classification = 'positive') as positive_replies
  from public.reachr_messages m
  join public.reachr_conversations c on c.id = m.conversation_id
  where c.marketplace_excluded = false and m.observed_at is not null
  group by 1
), totals as (
  select count(*) filter (where m.direction = 'outbound') as sent,
    count(*) filter (where m.direction = 'inbound') as replies,
    count(*) filter (where m.direction = 'inbound' and m.reply_classification = 'positive') as positive_replies
  from public.reachr_messages m
  join public.reachr_conversations c on c.id = m.conversation_id
  where c.marketplace_excluded = false
)
select jsonb_build_object(
  'localDate', (select today::text from local_day),
  'sentToday', coalesce((select sent from daily_counts where day = (select today from local_day)), 0),
  'totalConfirmed', (select sent from totals),
  'replies', (select replies from totals),
  'positiveReplies', (select positive_replies from totals),
  'dailyBreakdown', (select jsonb_agg(jsonb_build_object(
    'date',d.day::text,
    'sent',coalesce(c.sent,0),
    'replies',coalesce(c.replies,0),
    'positiveReplies',coalesce(c.positive_replies,0)
  ) order by d.day desc) from days d left join daily_counts c on c.day = d.day),
  'updatedAt', now()
) $$;
revoke all on function public.reachr_dashboard_summary() from public, anon;
grant execute on function public.reachr_dashboard_summary() to authenticated;
