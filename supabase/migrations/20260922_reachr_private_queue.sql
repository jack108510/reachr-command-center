-- Run once in the Supabase SQL Editor for xacehhtgvubcqdoltazg.
-- Customer conversations stay private behind authenticated RLS.
create extension if not exists pgcrypto;

create table if not exists public.reachr_conversations (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  business_name text not null,
  recipient_name text,
  sender_actor_id text,
  sender_actor_name text,
  messenger_url text,
  source text not null default 'messenger',
  marketplace_excluded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.reachr_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.reachr_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  observed_at timestamptz,
  provenance text not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, provenance)
);
create table if not exists public.reachr_reply_jobs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.reachr_conversations(id) on delete restrict,
  body text not null,
  status text not null default 'draft' check (status in ('draft','approved','claimed','sending','sent','failed','cancelled')),
  created_by uuid references auth.users(id),
  approved_at timestamptz,
  claimed_at timestamptz,
  delivery_evidence text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reachr_conversations enable row level security;
alter table public.reachr_messages enable row level security;
alter table public.reachr_reply_jobs enable row level security;

-- Browser roles cannot write conversations/messages or directly alter job states.
revoke all on public.reachr_conversations, public.reachr_messages, public.reachr_reply_jobs from public, anon, authenticated;
grant select on public.reachr_conversations, public.reachr_messages, public.reachr_reply_jobs to authenticated;
grant insert on public.reachr_reply_jobs to authenticated;
grant all on public.reachr_conversations, public.reachr_messages, public.reachr_reply_jobs to service_role;

create policy "Reachr operator can read conversations" on public.reachr_conversations for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com' and marketplace_excluded = false);
create policy "Reachr operator can read messages" on public.reachr_messages for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com' and exists (select 1 from public.reachr_conversations c where c.id = conversation_id and c.marketplace_excluded = false));
create policy "Reachr operator can read jobs" on public.reachr_reply_jobs for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com' and exists (select 1 from public.reachr_conversations c where c.id = conversation_id and c.marketplace_excluded = false));
create policy "Reachr operator can create drafts" on public.reachr_reply_jobs for insert to authenticated with check (
  (auth.jwt()->>'email') = 'wildejack1010@gmail.com'
  and status = 'draft' and created_by = auth.uid()
  and approved_at is null and claimed_at is null and delivery_evidence is null and failure_reason is null
  and exists (select 1 from public.reachr_conversations c where c.id = conversation_id and c.marketplace_excluded = false)
);
-- No direct client UPDATE policy: the browser cannot forge approved/sent states or alter exact approved copy.
create or replace function public.reachr_approve_draft(p_job_id uuid)
returns public.reachr_reply_jobs
language plpgsql security definer set search_path = '' as $$
declare v_job public.reachr_reply_jobs;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null or auth.jwt()->>'email' <> 'wildejack1010@gmail.com' then
    raise exception 'not authorized';
  end if;
  update public.reachr_reply_jobs j set status = 'approved', approved_at = now(), updated_at = now()
   where j.id = p_job_id and j.created_by = auth.uid() and j.status = 'draft'
     and exists (select 1 from public.reachr_conversations c where c.id = j.conversation_id and c.marketplace_excluded = false)
   returning j.* into v_job;
  if not found then raise exception 'draft unavailable'; end if;
  return v_job;
end $$;
revoke all on function public.reachr_approve_draft(uuid) from public, anon;
grant execute on function public.reachr_approve_draft(uuid) to authenticated;
