-- Suppression manuelle d'un doublon RSVP avec recalcul transactionnel de la liste d'attente.
-- À exécuter dans Supabase SQL Editor avant de fusionner la PR.

create or replace function public.delete_rsvp_duplicate_and_promote_waitlist(p_rsvp_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_guest_name text;
  v_promoted integer := 0;
  v_people integer;
  v_queue record;
  v_is_duplicate boolean;
begin
  -- Sérialise suppression, contrôle de capacité et promotions.
  perform pg_advisory_xact_lock(hashtext('dot-rsvp-guest-capacity-100'));

  select r.guest_name
    into v_guest_name
  from public.rsvp_responses r
  where r.id = p_rsvp_id
  for update;

  if not found then
    raise exception 'rsvp_not_found' using errcode = 'P0002';
  end if;

  -- Vérifie côté base qu'un nom de cette inscription ressemble bien
  -- au nom d'une personne rattachée à une autre inscription.
  with target_names as (
    select v_guest_name as full_name
    union all
    select c.full_name
    from public.rsvp_companions c
    where c.rsvp_id = p_rsvp_id
  ),
  other_names as (
    select r.id as rsvp_id, r.guest_name as full_name
    from public.rsvp_responses r
    where r.id <> p_rsvp_id
    union all
    select c.rsvp_id, c.full_name
    from public.rsvp_companions c
    where c.rsvp_id <> p_rsvp_id
  )
  select exists (
    select 1
    from target_names t
    join other_names o
      on public.dot_names_may_match(t.full_name, o.full_name)
  ) into v_is_duplicate;

  if not v_is_duplicate then
    raise exception 'duplicate_not_found' using errcode = 'P0001';
  end if;

  -- La FK ON DELETE CASCADE retire uniquement les accompagnateurs de ce dossier.
  delete from public.rsvp_responses
  where id = p_rsvp_id;

  -- Recalcule les places occupées, puis promeut les groupes FIFO qui tiennent entièrement.
  select coalesce(sum(r.person_count), 0)::integer
    into v_people
  from public.rsvp_responses r
  where r.attendance_status = 'accepted';

  for v_queue in
    select r.id, r.person_count
    from public.rsvp_responses r
    where r.attendance_status = 'waitlisted'
    order by r.created_at asc, r.id asc
    for update
  loop
    if v_people + v_queue.person_count <= 100 then
      update public.rsvp_responses
      set attendance_status = 'accepted',
          confirmed = true,
          updated_at = now()
      where id = v_queue.id;

      v_people := v_people + v_queue.person_count;
      v_promoted := v_promoted + 1;
    end if;
  end loop;

  return v_promoted;
end;
$function$;

revoke all on function public.delete_rsvp_duplicate_and_promote_waitlist(uuid) from public, anon, authenticated;
grant execute on function public.delete_rsvp_duplicate_and_promote_waitlist(uuid) to service_role;