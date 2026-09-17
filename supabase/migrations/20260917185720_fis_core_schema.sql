-- Integrated Farm Information System (FIS) — MVP core schema
-- Scope: URD Section 6 investor-pitch prototype. Mocked satellite data, one demo farm.

create extension if not exists pgcrypto;

-- Enumerations -------------------------------------------------------------

create type public.user_role as enum ('farmer', 'agronomist', 'bank_officer');

create type public.metric_type as enum ('soil_moisture', 'ndvi', 'rainfall');

create type public.land_use as enum ('cropland', 'grazing', 'degraded');

-- farms --------------------------------------------------------------------

create table public.farms (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  region            text not null,
  area_ha           numeric(10, 2) not null,
  centroid_lat      double precision not null,
  centroid_lon      double precision not null,
  boundary_geojson  jsonb not null,
  notes             text,
  created_at        timestamptz not null default now()
);

comment on table public.farms is
  'Demo farm parcels. MVP holds a single row: a real Brakwater smallholding north of Windhoek.';
comment on column public.farms.boundary_geojson is
  'GeoJSON Polygon geometry. Illustrative rectangle sized to the listed hectares, not surveyed parcel lines.';

-- farm_zones ---------------------------------------------------------------
-- Management zones inside a farm boundary. Readings are attached per zone so the
-- map overlays show spatial variation rather than one flat value across the parcel.

create table public.farm_zones (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid not null references public.farms (id) on delete cascade,
  name          text not null,
  land_use      public.land_use not null,
  area_ha       numeric(10, 2) not null,
  geojson       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (farm_id, name)
);

-- mock_readings ------------------------------------------------------------
-- Stands in for the URD's 3-vendor ingestion pipeline. vendor_label keeps the
-- "we aggregate 3 vendors" story visible without any real API calls.

create table public.mock_readings (
  id            bigint generated always as identity primary key,
  farm_id       uuid not null references public.farms (id) on delete cascade,
  zone_id       uuid references public.farm_zones (id) on delete cascade,
  vendor_label  text not null,
  metric_type   public.metric_type not null,
  value         double precision not null,
  unit          text not null,
  recorded_at   timestamptz not null,
  created_at    timestamptz not null default now()
);

create index mock_readings_farm_metric_time_idx
  on public.mock_readings (farm_id, metric_type, recorded_at desc);

create index mock_readings_zone_metric_time_idx
  on public.mock_readings (zone_id, metric_type, recorded_at desc);

-- profiles -----------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  role          public.user_role not null,
  organisation  text,
  created_at    timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. profiles.role drives which dashboard view is rendered.';

-- Row Level Security -------------------------------------------------------
-- Real multi-tenant permissioning is deferred (design decision 7), but RLS is on
-- so the anon key can never read anything without an authenticated session.

alter table public.farms         enable row level security;
alter table public.farm_zones    enable row level security;
alter table public.mock_readings enable row level security;
alter table public.profiles      enable row level security;

create policy "authenticated read farms"
  on public.farms for select to authenticated using (true);

create policy "authenticated read farm_zones"
  on public.farm_zones for select to authenticated using (true);

create policy "authenticated read mock_readings"
  on public.mock_readings for select to authenticated using (true);

create policy "read own profile"
  on public.profiles for select to authenticated using ((select auth.uid()) = id);
