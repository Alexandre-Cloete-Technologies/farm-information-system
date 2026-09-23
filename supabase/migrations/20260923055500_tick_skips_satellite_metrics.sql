-- The "live" random walk must never touch measured data.
--
-- It now skips any zone/metric that has satellite readings, so a real NDVI
-- series cannot be overwritten, nudged, or have a simulated row appended to
-- the end of it. Metrics with no satellite coverage keep ticking as before.

create or replace function public.tick_mock_readings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Soil moisture: +/- 0.4 percentage points, held inside a plausible band.
  insert into public.mock_readings
    (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at, is_simulated_tick, origin)
  select l.farm_id, l.zone_id, l.vendor_label, l.metric_type,
         greatest(2.0, least(45.0, l.value + (random() - 0.5) * 0.8)),
         l.unit, now(), true, 'simulated'
  from public.zone_latest_metrics l
  where l.metric_type = 'soil_moisture'
    and not exists (
      select 1 from public.mock_readings r
      where r.zone_id = l.zone_id
        and r.metric_type = l.metric_type
        and r.origin = 'satellite'
    );

  -- NDVI moves an order of magnitude more slowly than moisture.
  insert into public.mock_readings
    (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at, is_simulated_tick, origin)
  select l.farm_id, l.zone_id, l.vendor_label, l.metric_type,
         greatest(0.05, least(0.92, l.value + (random() - 0.5) * 0.008)),
         l.unit, now(), true, 'simulated'
  from public.zone_latest_metrics l
  where l.metric_type = 'ndvi'
    and not exists (
      select 1 from public.mock_readings r
      where r.zone_id = l.zone_id
        and r.metric_type = l.metric_type
        and r.origin = 'satellite'
    );

  -- Prune only simulated ticks; satellite history is never expired.
  delete from public.mock_readings
  where is_simulated_tick
    and origin = 'simulated'
    and recorded_at < now() - interval '6 hours';
end;
$$;

revoke all on function public.tick_mock_readings() from public, anon, authenticated;
