-- Limite les nouvelles réponses et les modifications à deux proches maximum.
-- Cette migration ne modifie aucune réponse déjà enregistrée.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.save_rsvp(text,text,text,boolean,text[],text[],boolean)'::regprocedure
  ) into v_definition;

  if position('if v_count > 9 or coalesce(array_length(v_keys, 1), 0) <> v_count then' in v_definition) = 0 then
    raise exception 'save_rsvp_definition_changed: companion validation clause not found';
  end if;
  if position('if v_count > coalesce(v_max, 0) then' in v_definition) = 0 then
    raise exception 'save_rsvp_definition_changed: companion update clause not found';
  end if;

  v_definition := replace(
    v_definition,
    'if v_count > 9 or coalesce(array_length(v_keys, 1), 0) <> v_count then',
    'if v_count > 2 or coalesce(array_length(v_keys, 1), 0) <> v_count then'
  );
  v_definition := replace(
    v_definition,
    'if v_count > coalesce(v_max, 0) then',
    'if v_count > least(coalesce(v_max, 0), 2) then'
  );

  execute v_definition;
end;
$$;
