-- Étapes réservées à la famille : non diffusées au public (le compte organisateur voit tout).
alter table public.program_items add column if not exists family_only boolean not null default false;

update public.program_items set family_only = true where phase = 'Matinée en famille';

drop policy if exists "Public can read program items" on public.program_items;
create policy "Public can read program items" on public.program_items
  for select to anon, authenticated
  using (not family_only);
