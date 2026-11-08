-- RSVP : plafond global de 100 invités, liste d'attente FIFO et limite SQL de 2 proches.
-- Les 20 places des organisateurs restent hors de ce calcul.
-- Les réponses historiques positives restent acceptées ; aucune réponse n'est supprimée.
begin;

alter table public.rsvp_responses
  add column if not exists attendance_status text;

update public.rsvp_responses
set attendance_status = case when confirmed then 'accepted' else 'declined' end
where attendance_status is null;

alter table public.rsvp_responses
  alter column attendance_status set default 'declined',
  alter column attendance_status set not null;

alter table public.rsvp_responses
  drop constraint if exists rsvp_responses_attendance_status_check;
alter table public.rsvp_responses
  add constraint rsvp_responses_attendance_status_check
  check (attendance_status in ('accepted', 'waitlisted', 'declined'));

alter table public.rsvp_responses
  drop constraint if exists rsvp_responses_max_companions_check;
alter table public.rsvp_responses
  add constraint rsvp_responses_max_companions_check
  check (max_companions >= 0 and max_companions <= 2);

alter table public.rsvp_companions
  drop constraint if exists rsvp_companions_position_check;
alter table public.rsvp_companions
  add constraint rsvp_companions_position_check
  check (position between 1 and 2);

create index if not exists rsvp_responses_capacity_queue_idx
  on public.rsvp_responses (attendance_status, created_at, id);

drop function if exists public.save_rsvp(text, text, text, boolean, text[], text[], boolean);

create function public.save_rsvp(
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
  v_guest_name_simple text := lower(trim(regexp_replace(coalesce(p_guest_name, ''), '\s+', ' ', 'g')));
  v_id uuid;
  v_max integer;
  v_created boolean := false;
  v_updated_at timestamptz;
  v_index integer;
  v_status text;
  v_current_people integer;
  v_queue record;
begin
  -- Verrou global transactionnel : deux confirmations simultanées ne peuvent pas dépasser 100.
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
  if p_guest_name is null or char_length(p_guest_name) < 2 or char_length(p_guest_name) > 120 then
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
      where lower(trim(regexp_replace(coalesce(n, ''), '\s+', ' ', 'g'))) = v_guest_name_simple
    ) then
      raise exception 'duplicate_companion' using errcode = '22023';
    end if;
  end if;

  select r.id, r.max_companions, r.attendance_status
    into v_id, v_max, v_status
  from public.rsvp_responses r
  where r.phone_normalized = p_phone_normalized
  for update;

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

revoke all on function public.save_rsvp(text, text, text, boolean, text[], text[], boolean) from public, anon, authenticated;
grant execute on function public.save_rsvp(text, text, text, boolean, text[], text[], boolean) to service_role;

commit;
