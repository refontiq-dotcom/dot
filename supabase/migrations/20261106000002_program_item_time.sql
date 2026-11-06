-- Heure de début et de fin de chaque étape du programme, modifiables depuis l'espace organisateurs.
alter table public.program_items add column if not exists time_begin text;
alter table public.program_items add column if not exists time_end text;
