-- 12 months of mocked satellite history for the demo farm.
-- Seasonality follows the Khomas Region pattern: wet Nov-Apr (peak Jan-Mar), dry May-Oct.
-- Vendor 1 -> soil moisture, Vendor 2 -> NDVI, Vendor 3 -> rainfall.
-- NOTE: 20260917185823 replaces the rainfall series produced here.

select setseed(0.42);

-- Rainfall: farm-level, daily -----------------------------------------------
insert into public.mock_readings (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at)
select
  f.id,
  null,
  'Vendor 3',
  'rainfall',
  case when random() < wet.factor * 0.38
       then round((random() * wet.factor * 34.0)::numeric, 1)::double precision
       else 0 end,
  'mm',
  d.day + time '06:00'
from public.farms f
cross join generate_series(current_date - 364, current_date, interval '1 day') as d(day)
cross join lateral (
  select (array[0.85,0.90,0.85,0.40,0.08,0.02,0.02,0.02,0.05,0.18,0.35,0.55])
           [extract(month from d.day)::int] as factor
) wet;

-- Soil moisture: per zone, daily ---------------------------------------------
insert into public.mock_readings (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at)
select
  z.farm_id,
  z.id,
  'Vendor 1',
  'soil_moisture',
  greatest(2.0, round((p.base + p.amp * s.season + (random() - 0.5) * 2.4)::numeric, 1)::double precision),
  '%',
  d.day + time '09:30'
from public.farm_zones z
cross join generate_series(current_date - 364, current_date, interval '1 day') as d(day)
cross join lateral (
  -- seasonal curve peaking mid-February
  select 0.5 + 0.5 * cos(2 * pi() * (extract(doy from d.day) - 46) / 365.0) as season
) s
cross join lateral (
  select case z.name
           when 'Maize Block'        then 18.0 when 'North Grazing Camp' then 8.0
           when 'South Grazing Camp' then  9.0 else 5.0 end as base,
         case z.name
           when 'Maize Block'        then 12.0 when 'North Grazing Camp' then 14.0
           when 'South Grazing Camp' then 13.0 else 9.0 end as amp
) p;

-- NDVI: per zone, every 5 days (satellite revisit cadence) --------------------
insert into public.mock_readings (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at)
select
  z.farm_id,
  z.id,
  'Vendor 2',
  'ndvi',
  greatest(0.05, least(0.92,
    round((p.base + p.amp * s.season + (random() - 0.5) * 0.05)::numeric, 3)::double precision)),
  'index',
  d.day + time '10:15'
from public.farm_zones z
cross join generate_series(current_date - 360, current_date, interval '5 days') as d(day)
cross join lateral (
  -- vegetation response lags rainfall by roughly three weeks
  select 0.5 + 0.5 * cos(2 * pi() * (extract(doy from d.day) - 67) / 365.0) as season
) s
cross join lateral (
  select case z.name
           when 'Maize Block'        then 0.22 when 'North Grazing Camp' then 0.15
           when 'South Grazing Camp' then 0.16 else 0.10 end as base,
         case z.name
           when 'Maize Block'        then 0.50 when 'North Grazing Camp' then 0.38
           when 'South Grazing Camp' then 0.36 else 0.18 end as amp
) p;
