-- Limitation atomique des tentatives RSVP par adresse IP hachée.
-- Une seule transaction vérifie le compteur et enregistre la tentative.
-- Aucun numéro de téléphone ni aucune donnée d'invité n'est stocké ici.

begin;

create or replace function public.consume_rsvp_rate_limit(
  p_ip_hash text,
  p_window_minutes integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_now timestamptz;
  v_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_window_minutes is null or p_window_minutes < 1 or p_window_minutes > 1440
     or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid_rate_limit_arguments' using errcode = '22023';
  end if;

  -- Verrou dédié à cette IP : deux requêtes simultanées ne peuvent pas
  -- toutes les deux passer sur la base d'un ancien compteur.
  perform pg_advisory_xact_lock(
    hashtextextended('dot-rsvp-rate-limit:' || p_ip_hash, 0)
  );

  v_now := clock_timestamp();

  select count(*)::integer
    into v_count
  from public.rsvp_rate_events
  where ip_hash = p_ip_hash
    and created_at >= v_now - make_interval(mins => p_window_minutes);

  if v_count >= p_limit then
    return true;
  end if;

  insert into public.rsvp_rate_events (ip_hash)
  values (p_ip_hash);

  return false;
end;
$function$;

revoke all on function public.consume_rsvp_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rsvp_rate_limit(text, integer, integer)
  to service_role;

commit;
