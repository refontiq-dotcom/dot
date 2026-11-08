-- Protection anti-doublon entre les invités principaux et leurs accompagnateurs.
-- Une correspondance exige au moins deux mots distinctifs communs et 75 %
-- des mots du nom le plus court. Aucun dossier existant n'est modifié.
begin;

create or replace function public.dot_name_tokens(p_name text)
returns text[]
language sql
immutable
parallel safe
set search_path = public
as $function$
  select coalesce(array_agg(token order by token), '{}'::text[])
  from (
    select distinct token
    from unnest(
      regexp_split_to_array(
        regexp_replace(
          translate(
            lower(coalesce(p_name, '')),
            'àáâãäåèéêëìíîïòóôõöùúûüýÿç',
            'aaaaaaeeeeiiiiooooouuuuyyc'
          ),
          '[^a-z0-9]+',
          ' ',
          'g'
        ),
        '\s+'
      )
    ) as parts(token)
    where length(token) > 1
      and token not in ('epse', 'epouse', 'mme', 'mr', 'madame', 'monsieur', 'de', 'du', 'des', 'le', 'la', 'les')
  ) normalized;
$function$;

create or replace function public.dot_names_may_match(p_left text, p_right text)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $function$
  with left_tokens as (
    select public.dot_name_tokens(p_left) as tokens
  ),
  right_tokens as (
    select public.dot_name_tokens(p_right) as tokens
  )
  select
    cardinality(left_tokens.tokens) >= 2
    and cardinality(right_tokens.tokens) >= 2
    and (
      select count(*)
      from unnest(left_tokens.tokens) as candidate(token)
      where candidate.token = any(right_tokens.tokens)
    ) * 4 >= least(cardinality(left_tokens.tokens), cardinality(right_tokens.tokens)) * 3
  from left_tokens
  cross join right_tokens;
$function$;

revoke all on function public.dot_name_tokens(text) from public, anon, authenticated;
revoke all on function public.dot_names_may_match(text, text) from public, anon, authenticated;

create or replace function public.save_rsvp(
  p_phone text,
  p_phone_normalized text,
  p_guest_name text,
  p_attending boolean,
  p_companion_names text[],
  p_companion_name_keys text[],
  p_allow_update boolean default false
)
returns table (
  saved_rsvp_id uuid,
  saved_created boolean,
  saved_updated_at timestamptz,
  saved_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_names text[] := coalesce(p_companion_names, '{}'::text[]);
  v_keys text[] := coalesce(p_companion_name_keys, '{}'::text[]);
  v_count integer := coalesce(array_length(v_names, 1), 0);
  v_incoming_names text[];
  v_id uuid;
  v_max integer;
  v_created boolean := false;
  v_updated_at timestamptz;
  v_index integer;
  v_other_index integer;
  v_status text;
  v_current_people integer;
  v_queue record;
begin
  -- Verrou global : le contrôle anti-doublon et la limite de 100 sont atomiques.
  perform pg_advisory_xact_lock(hashtext('dot-rsvp-guest-capacity-100'));

  if p_phone_normalized is null or p_phone_normalized !~ '^\+225[0-9]{10}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if substring(p_phone_normalized from 5 for 2) not in ('01', '05', '07', '21', '22', '23', '25', '27') then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_phone is null or char_length(p_phone) < 8 or char_length(p_phone) > 32 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_guest_name is null or char_length(p_guest_name) < 2 or char_length(p_guest_name) > 120
     or p_guest_name !~ '[[:alpha:]]' then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_attending is null then
    raise exception 'invalid_attendance' using errcode = '22023';
  end if;
  if v_count > 2 or coalesce(array_length(v_keys, 1), 0) <> v_count then
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
    if exists (
      select 1 from unnest(v_names) as n
      where lower(trim(regexp_replace(coalesce(n, ''), '\s+', ' ', 'g'))) =
            lower(trim(regexp_replace(coalesce(p_guest_name, ''), '\s+', ' ', 'g')))
    ) then
      raise exception 'duplicate_companion' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(v_names) as n where n is null or n !~ '[[:alpha:]]') then
      raise exception 'invalid_companions' using errcode = '22023';
    end if;
  end if;

  -- Le principal et ses accompagnateurs ne doivent pas se recouper.
  v_incoming_names := array[p_guest_name] || v_names;
  if cardinality(v_incoming_names) > 1 then
    for v_index in 1..(cardinality(v_incoming_names) - 1) loop
      for v_other_index in (v_index + 1)..cardinality(v_incoming_names) loop
        if public.dot_names_may_match(v_incoming_names[v_index], v_incoming_names[v_other_index]) then
          raise exception 'duplicate_companion' using errcode = 'P0001';
        end if;
      end loop;
    end loop;
  end if;

  select r.id, r.max_companions, r.attendance_status
    into v_id, v_max, v_status
  from public.rsvp_responses r
  where r.phone_normalized = p_phone_normalized
  for update;

  -- Contrôle atomique de tous les noms déjà enregistrés, principal et accompagnateurs.
  -- Le dossier courant est exclu lors d'une modification avec le même téléphone.
  if exists (
    with incoming as (
      select unnest(v_incoming_names) as full_name
    ),
    existing as (
      select r.id as rsvp_id, r.guest_name as full_name
      from public.rsvp_responses r
      union all
      select c.rsvp_id, c.full_name
      from public.rsvp_companions c
    )
    select 1
    from incoming i
    join existing e
      on public.dot_names_may_match(i.full_name, e.full_name)
    where e.rsvp_id is distinct from v_id
  ) then
    raise exception 'possible_duplicate_name' using errcode = 'P0001';
  end if;

  if v_id is null then
    if p_attending then
      select coalesce(sum(r.person_count), 0)::integer into v_current_people
      from public.rsvp_responses r
      where r.attendance_status = 'accepted';

      v_status := case when v_current_people + v_count + 1 <= 100 then 'accepted' else 'waitlisted' end;
    else
      v_status := 'declined';
    end if;

    insert into public.rsvp_responses
      (guest_name, person_count, confirmed, phone, phone_normalized, max_companions, attendance_status)
    values
      (p_guest_name, case when p_attending then v_count + 1 else 0 end,
       v_status = 'accepted', p_phone, p_phone_normalized,
       case when p_attending then v_count else 0 end, v_status)
    returning id, updated_at into v_id, v_updated_at;
    v_created := true;
  else
    if not p_allow_update then
      raise exception 'already_registered' using errcode = 'P0001';
    end if;
    if v_count > least(coalesce(v_max, 0), 2) then
      raise exception 'companions_limit' using errcode = 'P0001';
    end if;

    if p_attending then
      select coalesce(sum(r.person_count), 0)::integer into v_current_people
      from public.rsvp_responses r
      where r.attendance_status = 'accepted'
        and r.id <> v_id;
      v_status := case when v_current_people + v_count + 1 <= 100 then 'accepted' else 'waitlisted' end;
    else
      v_status := 'declined';
    end if;

    update public.rsvp_responses r
    set guest_name = p_guest_name,
        confirmed = (v_status = 'accepted'),
        attendance_status = v_status,
        person_count = case when p_attending then v_count + 1 else 0 end,
        phone = p_phone,
        updated_at = now()
    where r.id = v_id
    returning r.updated_at into v_updated_at;
  end if;

  delete from public.rsvp_companions c
  where c.rsvp_id = v_id and c.position > v_count;

  if v_count > 0 then
    for v_index in 1..v_count loop
      insert into public.rsvp_companions (rsvp_id, full_name, name_normalized, position)
      values (v_id, v_names[v_index], v_keys[v_index], v_index)
      on conflict (rsvp_id, position) do update
      set full_name = excluded.full_name, name_normalized = excluded.name_normalized;
    end loop;
  end if;

  -- Promotion automatique FIFO : un groupe est accepté uniquement s'il tient entièrement.
  select coalesce(sum(r.person_count), 0)::integer into v_current_people
  from public.rsvp_responses r
  where r.attendance_status = 'accepted';

  for v_queue in
    select r.id, r.person_count
    from public.rsvp_responses r
    where r.attendance_status = 'waitlisted'
    order by r.created_at asc, r.id asc
    for update
  loop
    if v_current_people + v_queue.person_count <= 100 then
      update public.rsvp_responses
      set attendance_status = 'accepted', confirmed = true, updated_at = now()
      where id = v_queue.id;
      v_current_people := v_current_people + v_queue.person_count;
    end if;
  end loop;

  select r.attendance_status into v_status
  from public.rsvp_responses r where r.id = v_id;

  return query select v_id, v_created, v_updated_at, v_status;
end;
$function$;

commit;
