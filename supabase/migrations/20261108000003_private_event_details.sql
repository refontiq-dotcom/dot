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

with source as (
  select value
  from public.site_content
  where key = 'content'
  union all
  select '{}'::jsonb
  limit 1
)
insert into public.private_event_details (id, venue, venue_detail, map_url, travel)
select
  'main',
  coalesce(nullif(value->>'venue', ''), 'Cocody Angré Mahou'),
  coalesce(nullif(value->>'venueDetail', ''), 'Près de Laser Park'),
  coalesce(nullif(value->>'mapUrl', ''), 'https://maps.app.goo.gl/EnyMdjAcEYsvyqW48'),
  coalesce(value->'travel', jsonb_build_object(
    'stopName', 'Commissariat du 22e arrondissement',
    'walkNote', 'Depuis l’arrêt, marchez jusqu’à Laser Park, puis jusqu’au lieu de réception.',
    'taxiFrom', 'Carrefour La Vie',
    'taxiStop', 'Carrefour du commissariat du 22e arrondissement',
    'taxiDestination', 'Laser Park, Cocody Angré Mahou',
    'busLines', jsonb_build_array(
      jsonb_build_object('id','bus-81','number','81','from','Gare Nord (Adjamé)','to',''),
      jsonb_build_object('id','bus-82','number','82','from','Gare Sud (Plateau)','to',''),
      jsonb_build_object('id','bus-90','number','90','from','Cocody Blockhaus','to',''),
      jsonb_build_object('id','bus-719','number','719','from','Yopougon Saint-André','to','Cocody Terminus 81-82'),
      jsonb_build_object('id','bus-775','number','775','from','Gare de Bassam (Treichville)','to','Angré Château (Cocody)'),
      jsonb_build_object('id','bus-704','number','704','from','Saint-Jean (Cocody)','to','Angré Château')
    )
  ))
from source
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
