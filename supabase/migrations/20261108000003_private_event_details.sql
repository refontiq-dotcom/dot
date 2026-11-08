-- Isole le indications privées du lieu et du trajet hors des données publiques.
-- Les informations existantes sont déplacées sans être perdues.
begin;

create table if not exists public.private_event_details (
  id text primary key,
  venue text not null default '',
  venue_detail text not null default '',
  map_url text not null default '',
  travel jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.private_event_details (id, venue, venue_detail, map_url, travel)
select
  'main',
  coalesce(value->>'venue', ''),
  coalesce(value->>'venueDetail', ''),
  coalesce(value->>'mapUrl', ''),
  coalesce(value->'travel', '{}'::jsonb)
from public.site_content
where key = 'content'
on conflict (id) do update set
  venue = case when excluded.venue <> '' then excluded.venue else private_event_details.venue end,
  venue_detail = case when excluded.venue_detail <> '' then excluded.venue_detail else private_event_details.venue_detail end,
  map_url = case when excluded.map_url <> '' then excluded.map_url else private_event_details.map_url end,
  travel = case when excluded.travel <> '{}'::jsonb then excluded.travel else private_event_details.travel end,
  updated_at = now();

-- Retire ces champs de la ligne publique : ils ne doivent plus être exposés via l'API REST.
update public.site_content
set value = coalesce(value, '{}'::jsonb) - 'venue' - 'venueDetail' - 'mapUrl' - 'travel',
    updated_at = now()
where key = 'content';

alter table public.private_event_details enable row level security;
revoke all on public.private_event_details from public, anon, authenticated;
grant all on public.private_event_details to service_role;

commit;
