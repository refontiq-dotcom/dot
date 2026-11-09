create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references public.rsvp_responses(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_rsvp_id_idx
  on public.push_subscriptions (rsvp_id);

alter table public.push_subscriptions enable row level security;

comment on table public.push_subscriptions is
  'Abonnements Web Push des invités confirmés. Accès serveur uniquement via service_role.';
