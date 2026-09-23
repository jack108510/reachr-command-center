-- Private, operator-managed reply scripts for the Command Center.
create table if not exists public.reachr_script_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  category text not null default 'acquisition' check (char_length(trim(category)) between 1 and 40),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.reachr_touch_script_template()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists reachr_touch_script_template on public.reachr_script_templates;
create trigger reachr_touch_script_template before update on public.reachr_script_templates
for each row execute function public.reachr_touch_script_template();

alter table public.reachr_script_templates enable row level security;
revoke all on public.reachr_script_templates from public, anon, authenticated;
grant select, insert on public.reachr_script_templates to authenticated;
grant update (title, category, body, is_active) on public.reachr_script_templates to authenticated;
grant all on public.reachr_script_templates to service_role;

drop policy if exists "Reachr operator reads scripts" on public.reachr_script_templates;
drop policy if exists "Reachr operator creates scripts" on public.reachr_script_templates;
drop policy if exists "Reachr operator updates scripts" on public.reachr_script_templates;
create policy "Reachr operator reads scripts" on public.reachr_script_templates
  for select to authenticated using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com');
create policy "Reachr operator creates scripts" on public.reachr_script_templates
  for insert to authenticated with check (
    (auth.jwt()->>'email') = 'wildejack1010@gmail.com' and created_by = auth.uid()
  );
create policy "Reachr operator updates scripts" on public.reachr_script_templates
  for update to authenticated
  using ((auth.jwt()->>'email') = 'wildejack1010@gmail.com')
  with check ((auth.jwt()->>'email') = 'wildejack1010@gmail.com');

insert into public.reachr_script_templates (id,title,category,body,is_active)
values (
  '0b7a4c89-3d73-4b9f-a9c5-c2a98031da65',
  'Interested — personalized posting plan',
  'acquisition',
  'Thanks for your interest. I noticed you’ve been posting [specific offer you actually saw]. Reachr could help share that promotion in relevant Facebook groups around [area], on a schedule you approve—for example, around [time] each day where the groups allow it. Would you like me to put together a sample posting plan for [business]?',
  true
)
on conflict (id) do nothing;
