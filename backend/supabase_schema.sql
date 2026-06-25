-- ============================================================
-- STAS – Smart Traffic Alert System
-- Supabase / PostgreSQL Database Schema
-- Run this entire file in Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. Enable UUID extension ────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── 2. USERS ────────────────────────────────────────────────
create table if not exists public.users (
  id            uuid primary key default uuid_generate_v4(),
  email         text not null unique,
  full_name     text not null default '',
  role          text not null default 'CITIZEN'
                check (role in ('GUEST','CITIZEN','OFFICER','ANALYST','ADMIN')),
  phone         text,
  is_verified   boolean not null default false,
  created_at    timestamptz not null default now(),
  last_login    timestamptz
);

-- Sync new Supabase Auth users into public.users automatically
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'CITIZEN')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 3. ROUTES ───────────────────────────────────────────────
create table if not exists public.routes (
  id                varchar(10) primary key,
  name              text not null,
  region            text not null default 'CENTRAL',
  start_location    text not null,
  end_location      text not null,
  length_km         numeric(6,1) not null default 0,
  congestion_index  integer not null default 50
                    check (congestion_index between 0 and 100),
  current_status    text not null default 'UNKNOWN'
                    check (current_status in ('CLEAR','MODERATE','HEAVY','CRITICAL','UNKNOWN')),
  lat               numeric(9,6),
  lng               numeric(9,6),
  created_at        timestamptz not null default now()
);

-- Seed the 12 Kampala corridors
insert into public.routes (id, name, region, start_location, end_location, length_km, congestion_index, current_status, lat, lng)
values
  ('R001','Entebbe Road',     'CENTRAL','Kampala CBD',     'Entebbe Airport',  42, 72,'HEAVY',    0.3163, 32.5812),
  ('R002','Jinja Road',       'CENTRAL','Kampala CBD',     'Mukono',           21, 85,'CRITICAL', 0.3350, 32.6100),
  ('R003','Northern Bypass',  'CENTRAL','Busega Junction', 'Kyebando',         22, 38,'MODERATE', 0.3400, 32.5300),
  ('R004','Kampala Road',     'CENTRAL','Clock Tower',     'Mukono',           16, 91,'CRITICAL', 0.3163, 32.5812),
  ('R005','Ggaba Road',       'CENTRAL','Centenary Park',  'Ggaba',             9, 28,'MODERATE', 0.3150, 32.5780),
  ('R006','Gayaza Road',      'CENTRAL','Kampala CBD',     'Gayaza',           20, 55,'HEAVY',    0.3200, 32.5850),
  ('R007','Masaka Road',      'CENTRAL','Kampala CBD',     'Nsangi',           12, 18,'CLEAR',    0.3160, 32.5760),
  ('R008','Bombo Road',       'CENTRAL','Kampala CBD',     'Bombo',            38, 62,'HEAVY',    0.3200, 32.5820),
  ('R009','Portbell Road',    'CENTRAL','Nakawa',          'Portbell',          8, 44,'MODERATE', 0.3350, 32.6100),
  ('R010','Nansana Corridor', 'CENTRAL','Kampala CBD',     'Nansana',           9, 77,'CRITICAL', 0.3611, 32.5135),
  ('R011','Namirembe Road',   'CENTRAL','Old Taxi Park',   'Lubaga',            3, 50,'HEAVY',    0.3147, 32.5816),
  ('R012','Mukwano Road',     'CENTRAL','Katwe',           'Industrial Area',   4, 33,'MODERATE', 0.3100, 32.5700)
on conflict (id) do nothing;

-- ── 4. INCIDENTS ────────────────────────────────────────────
create table if not exists public.incidents (
  id            uuid primary key default uuid_generate_v4(),
  route_id      varchar(10) references public.routes(id) on delete set null,
  type          text not null
                check (type in ('JAM','ACCIDENT','WORKS','FLOODING','LIGHT','CONVOY','OTHER')),
  severity      text not null default 'MEDIUM'
                check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  latitude      numeric(9,6) not null,
  longitude     numeric(9,6) not null,
  address       text not null default '',
  description   text not null,
  photo_urls    text[] default '{}',
  status        text not null default 'PENDING'
                check (status in ('PENDING','VERIFIED','RESOLVED','REJECTED')),
  reported_by   uuid references public.users(id) on delete set null,
  is_anonymous  boolean not null default false,
  verified_by   uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists incidents_route_id_idx  on public.incidents(route_id);
create index if not exists incidents_status_idx    on public.incidents(status);
create index if not exists incidents_created_at_idx on public.incidents(created_at desc);

-- ── 5. PREDICTIONS ──────────────────────────────────────────
create table if not exists public.predictions (
  id                          uuid primary key default uuid_generate_v4(),
  route_id                    varchar(10) not null references public.routes(id) on delete cascade,
  congestion_level            text not null
                              check (congestion_level in ('CLEAR','MODERATE','HEAVY','CRITICAL')),
  congestion_index            integer not null check (congestion_index between 0 and 100),
  confidence                  numeric(3,2) not null default 0.72,
  predicted_avg_speed_kmh     numeric(5,1),
  estimated_clearance_minutes integer default 0,
  contributing_factors        text[] default '{}',
  input_features              jsonb default '{}',
  predicted_at                timestamptz not null default now()
);

create index if not exists predictions_route_id_idx   on public.predictions(route_id);
create index if not exists predictions_predicted_at_idx on public.predictions(predicted_at desc);

-- Latest prediction per route (used by GET /api/predict/latest)
create or replace function public.latest_predictions_per_route()
returns table (
  id uuid, route_id varchar, congestion_level text,
  congestion_index integer, confidence numeric,
  predicted_avg_speed_kmh numeric, estimated_clearance_minutes integer,
  contributing_factors text[], predicted_at timestamptz
) language sql stable as $$
  select distinct on (route_id)
    id, route_id, congestion_level, congestion_index, confidence,
    predicted_avg_speed_kmh, estimated_clearance_minutes,
    contributing_factors, predicted_at
  from public.predictions
  order by route_id, predicted_at desc;
$$;

-- ── 6. ALERT SUBSCRIPTIONS ──────────────────────────────────
create table if not exists public.alert_subscriptions (
  user_id   uuid not null references public.users(id) on delete cascade,
  route_id  varchar(10) not null references public.routes(id) on delete cascade,
  channel   text not null default 'PUSH' check (channel in ('PUSH','SMS')),
  primary key (user_id, route_id)
);

-- ── 7. Row Level Security ────────────────────────────────────
alter table public.users               enable row level security;
alter table public.routes              enable row level security;
alter table public.incidents           enable row level security;
alter table public.predictions         enable row level security;
alter table public.alert_subscriptions enable row level security;

-- Everyone can read routes and predictions
create policy "routes_public_read"      on public.routes      for select using (true);
create policy "predictions_public_read" on public.predictions  for select using (true);
create policy "incidents_public_read"   on public.incidents    for select using (true);

-- Users can read their own profile
create policy "users_own_read" on public.users
  for select using (auth.uid() = id);

-- Service role bypasses RLS (used by backend with service_role key)
-- (Supabase automatically grants service_role full access)

-- ── 8. Grant permissions ─────────────────────────────────────
grant usage  on schema public to anon, authenticated;
grant select on public.routes, public.predictions, public.incidents to anon;
grant all    on public.users, public.incidents, public.predictions,
                public.alert_subscriptions to authenticated;
