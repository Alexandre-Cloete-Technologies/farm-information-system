-- Simulated "live" vendor feed.
--
-- Every two minutes each zone gets a fresh soil-moisture and NDVI reading that
-- random-walks from its previous value. Left open during a pitch, the numbers
-- visibly move — the narrative is "three vendors streaming in" without touching
-- a real API. Nothing depends on this: switch the job off and the dashboard
-- still works off the seeded history.

create extension if not exists pg_cron with schema extensions;

alter table public.mock_readings
  add column if not exists is_simulated_tick boolean not null default false;

create index if not exists mock_readings_tick_idx
  on public.mock_readings (recorded_at) where is_simulated_tick;

create or replace function public.tick_mock_readings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Soil moisture: +/- 0.4 percentage points, held inside a plausible band.
  insert into public.mock_readings
    (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at, is_simulated_tick)
  select l.farm_id, l.zone_id, l.vendor_label, l.metric_type,
         greatest(2.0, least(45.0, l.value + (random() - 0.5) * 0.8)),
         l.unit, now(), true
  from public.zone_latest_metrics l
  where l.metric_type = 'soil_moisture';

  -- NDVI moves an order of magnitude more slowly than moisture.
  insert into public.mock_readings
    (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at, is_simulated_tick)
  select l.farm_id, l.zone_id, l.vendor_label, l.metric_type,
         greatest(0.05, least(0.92, l.value + (random() - 0.5) * 0.008)),
         l.unit, now(), true
  from public.zone_latest_metrics l
  where l.metric_type = 'ndvi';

  -- Keep the table from growing without bound on a free-tier project.
  delete from public.mock_readings
  where is_simulated_tick and recorded_at < now() - interval '6 hours';
end;
$$;

revoke all on function public.tick_mock_readings() from public, anon, authenticated;

select cron.schedule('fis-live-feed-tick', '*/2 * * * *', 'select public.tick_mock_readings();');
