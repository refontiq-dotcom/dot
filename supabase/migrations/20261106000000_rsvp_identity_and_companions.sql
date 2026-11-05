-- Identification des invités par téléphone et accompagnateurs nommés.
-- Inscription sans compte : un même numéro met simplement à jour la réponse existante.
-- Migration strictement additive : aucune ligne existante n'est supprimée ni réécrite.
-- Les colonnes ajoutées sont nullables afin de rester compatibles avec les réponses déjà reçues.

begin;

-- 1. Identité téléphonique et horodatage.
alter table public.rsvp_responses
  add column if not exists phone text,
  add column if not exists phone_normalized text,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.rsvp_responses.phone is 'Numéro tel que saisi, pour l’affichage organisateur.';
comment on column public.rsvp_responses.phone_normalized is 'Numéro normalisé +225XXXXXXXXXX, identifiant unique de l’inscription.';

-- Un même numéro ne peut produire qu'une seule inscription. Les lignes historiques (NULL) restent valides.
create unique index if not exists rsvp_responses_phone_normalized_key
  on public.rsvp_responses (phone_normalized)
  where phone_normalized is not null;

-- 2. Horodatage de mise à jour partagé.
create or replace function public.dot_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rsvp_responses_touch_updated_at on public.rsvp_responses;
create trigger rsvp_responses_touch_updated_at
  before update on public.rsvp_responses
  for each row execute function public.dot_touch_updated_at();

-- 3. Accompagnateurs enregistrés individuellement (une ligne par personne).
create table if not exists public.rsvp_companions (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references public.rsvp_responses(id) on delete cascade,
  full_name text not null,
  name_normalized text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rsvp_companions_position_check check (position between 1 and 9),
  constraint rsvp_companions_name_check check (char_length(full_name) between 2 and 120),
  constraint rsvp_companions_unique_position unique (rsvp_id, position)
);

comment on table public.rsvp_companions is 'Accompagnateurs nommés, rattachés à un invité principal. Aucun numéro de téléphone propre.';

create index if not exists rsvp_companions_rsvp_id_idx on public.rsvp_companions (rsvp_id);
create index if not exists rsvp_companions_name_normalized_idx on public.rsvp_companions (name_normalized);

drop trigger if exists rsvp_companions_touch_updated_at on public.rsvp_companions;
create trigger rsvp_companions_touch_updated_at
  before update on public.rsvp_companions
  for each row execute function public.dot_touch_updated_at();

alter table public.rsvp_companions enable row level security;

drop policy if exists "Organizer can read RSVP companions" on public.rsvp_companions;
create policy "Organizer can read RSVP companions"
  on public.rsvp_companions for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'refontiq@gmail.com');

revoke all on public.rsvp_companions from anon;
revoke insert, update, delete on public.rsvp_companions from anon, authenticated;
grant select on public.rsvp_companions to authenticated;
grant all on public.rsvp_companions to service_role;

-- 4. Les colonnes ajoutées restent protégées par la RLS existante (organisateur uniquement).

-- 5. Limitation de débit persistante (Vercel = plusieurs instances, mémoire non partagée).
create table if not exists public.rsvp_rate_events (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists rsvp_rate_events_ip_created_idx
  on public.rsvp_rate_events (ip_hash, created_at desc);

alter table public.rsvp_rate_events enable row level security;
revoke all on public.rsvp_rate_events from anon, authenticated;
grant all on public.rsvp_rate_events to service_role;

-- 6. Enregistrement transactionnel : création ou mise à jour par téléphone + accompagnateurs.
create or replace function public.save_rsvp(
  p_phone text,
  p_phone_normalized text,
  p_guest_name text,
  p_attending boolean,
  p_companion_names text[],
  p_companion_name_keys text[]
)
returns table (saved_rsvp_id uuid, saved_created boolean, saved_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_names text[] := coalesce(p_companion_names, '{}'::text[]);
  v_keys text[] := coalesce(p_companion_name_keys, '{}'::text[]);
  v_count integer := coalesce(array_length(v_names, 1), 0);
  v_id uuid;
  v_created boolean := false;
  v_updated_at timestamptz;
  v_index integer;
begin
  if p_phone_normalized is null or p_phone_normalized !~ '^\+225[0-9]{10}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if substring(p_phone_normalized from 5 for 2) not in ('01', '05', '07', '21', '22', '23', '25', '27') then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_phone is null or char_length(p_phone) < 8 or char_length(p_phone) > 32 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_guest_name is null or char_length(p_guest_name) < 2 or char_length(p_guest_name) > 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_attending is null then
    raise exception 'invalid_attendance' using errcode = '22023';
  end if;
  if v_count > 9 or coalesce(array_length(v_keys, 1), 0) <> v_count then
    raise exception 'invalid_companions' using errcode = '22023';
  end if;
  if not p_attending and v_count > 0 then
    raise exception 'companions_without_attendance' using errcode = '22023';
  end if;
  if v_count > 0 then
    if exists (select 1 from unnest(v_keys) as k where k is null or char_length(k) < 1) then
      raise exception 'invalid_companions' using errcode = '22023';
    end if;
    if (select count(*) from (select distinct unnest(v_keys)) as d) <> v_count then
      raise exception 'duplicate_companion' using errcode = '22023';
    end if;
  end if;

  select r.id into v_id
  from public.rsvp_responses r
  where r.phone_normalized = p_phone_normalized
  for update;

  if v_id is null then
    begin
      insert into public.rsvp_responses (guest_name, person_count, confirmed, phone, phone_normalized)
      values (
        p_guest_name,
        case when p_attending then v_count + 1 else 0 end,
        p_attending,
        p_phone,
        p_phone_normalized
      )
      returning id, updated_at into v_id, v_updated_at;
      v_created := true;
    exception when unique_violation then
      -- Une requête concurrente vient de créer la même inscription : on la met à jour.
      select r.id into v_id
      from public.rsvp_responses r
      where r.phone_normalized = p_phone_normalized
      for update;
      if v_id is null then
        raise exception 'rsvp_conflict' using errcode = 'P0001';
      end if;
    end;
  end if;

  if not v_created then
    update public.rsvp_responses r
      set guest_name = p_guest_name,
          confirmed = p_attending,
          person_count = case when p_attending then v_count + 1 else 0 end,
          phone = p_phone,
          updated_at = now()
      where r.id = v_id
      returning r.updated_at into v_updated_at;
  end if;

  -- Les accompagnateurs sont synchronisés par position : ajout, correction, retrait.
  delete from public.rsvp_companions c
   where c.rsvp_id = v_id and c.position > v_count;

  if v_count > 0 then
    for v_index in 1..v_count loop
      insert into public.rsvp_companions (rsvp_id, full_name, name_normalized, position)
      values (v_id, v_names[v_index], v_keys[v_index], v_index)
      on conflict (rsvp_id, position) do update
        set full_name = excluded.full_name,
            name_normalized = excluded.name_normalized;
    end loop;
  end if;

  return query select v_id, v_created, v_updated_at;
end;
$$;

revoke all on function public.save_rsvp(text, text, text, boolean, text[], text[]) from public;
revoke all on function public.save_rsvp(text, text, text, boolean, text[], text[]) from anon, authenticated;
grant execute on function public.save_rsvp(text, text, text, boolean, text[], text[]) to service_role;

commit;
