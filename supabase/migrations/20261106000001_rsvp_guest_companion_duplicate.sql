-- Complément à 20261106000000_rsvp_identity_and_companions.sql
-- Ajoute une protection base de données : un accompagnateur ne peut pas porter
-- le même nom que l'invité principal. La vérification complète (accents, ordre
-- des mots) reste faite par l'API ; ce contrôle SQL est une protection simple
-- en défense de profondeur (casse/espaces ignorés), car save_rsvp est réservé
-- à service_role et ne reçoit pas la clé normalisée de l'invité principal.
-- Idempotent : CREATE OR REPLACE remplace uniquement la fonction.

begin;

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
  v_guest_name_simple text := lower(trim(regexp_replace(coalesce(p_guest_name, ''), '\s+', ' ', 'g')));
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
    -- Protection simple : même nom que l'invité principal (casse/espaces).
    -- La normalisation complète (accents, ordre des mots) est faite par l'API.
    if exists (
      select 1
      from unnest(v_names) as n
      where lower(trim(regexp_replace(coalesce(n, ''), '\s+', ' ', 'g'))) = v_guest_name_simple
    ) then
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
