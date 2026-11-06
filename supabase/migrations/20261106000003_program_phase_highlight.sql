-- Partie de la journée et temps forts du programme (time_begin et time_end viennent de la migration précédente).
-- Idempotent : time_begin / time_end existaient déjà sur la base Dot.
alter table public.program_items add column if not exists time_begin text;
alter table public.program_items add column if not exists time_end text;
alter table public.program_items add column if not exists phase text;
alter table public.program_items add column if not exists highlight boolean not null default false;
