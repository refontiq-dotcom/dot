-- Secure the Dot event data and align the database with the public content model.
-- Organizer access is restricted to the verified Supabase Auth identity for refontiq@gmail.com.
-- RSVP writes are intentionally server-only; do not expose the service role key to browsers.

create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  confirmed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faq_items enable row level security;
alter table public.site_content enable row level security;
alter table public.program_items enable row level security;
alter table public.rsvp_responses enable row level security;

-- The read-only audit confirmed these tables currently have no policies.

create policy "Public can read site content"
  on public.site_content for select to anon, authenticated
  using (true);
create policy "Organizer can manage site content"
  on public.site_content for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'refontiq@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'refontiq@gmail.com');

create policy "Public can read program items"
  on public.program_items for select to anon, authenticated
  using (true);
create policy "Organizer can manage program items"
  on public.program_items for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'refontiq@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'refontiq@gmail.com');

create policy "Public can read FAQ items"
  on public.faq_items for select to anon, authenticated
  using (true);
create policy "Organizer can manage FAQ items"
  on public.faq_items for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'refontiq@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'refontiq@gmail.com');

create policy "Organizer can read RSVP responses"
  on public.rsvp_responses for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'refontiq@gmail.com');

-- The public site may read published content. Only authenticated organizers can edit it.
grant select on public.site_content, public.program_items, public.faq_items to anon, authenticated;
grant insert, update, delete on public.site_content, public.program_items, public.faq_items to authenticated;
grant select on public.rsvp_responses to authenticated;
revoke all on public.rsvp_responses from anon;
revoke insert, update, delete on public.rsvp_responses from anon, authenticated;
grant all on public.rsvp_responses to service_role;
