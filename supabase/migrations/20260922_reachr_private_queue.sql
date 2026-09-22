-- Run once in the Supabase SQL Editor for xacehhtgvubcqdoltazg.
-- Customer conversations stay private behind authenticated RLS.
create extension if not exists pgcrypto;

create table if not exists public.reachr_conversations (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  business_name text not null,
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
  created_at timestamptz not null default now()
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

create policy "Reachr operator can read conversations" on public.reachr_conversations for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com');
create policy "Reachr operator can read messages" on public.reachr_messages for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com');
create policy "Reachr operator can read jobs" on public.reachr_reply_jobs for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com');
create policy "Reachr operator can create drafts" on public.reachr_reply_jobs for insert to authenticated with check ((auth.jwt()->>'email') = 'wildejack1010@gmail.com' and status = 'draft' and created_by = auth.uid());
create policy "Reachr operator can approve own draft" on public.reachr_reply_jobs for update to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com' and status in ('draft','approved','cancelled')) with check ((auth.jwt()->>'email') = 'wildejack1010@gmail.com' and status in ('draft','approved','cancelled'));
