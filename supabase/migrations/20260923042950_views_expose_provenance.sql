-- Surface provenance through the views the dashboards read.
--
-- zone_latest_metrics now prefers a measured reading over a simulated one for
-- the same zone and metric, regardless of timestamp: the simulated tick writes
-- with now(), while a satellite observation carries its real acquisition date
-- and is always a few days old. Without this ordering a modelled value would
-- outrank a measurement purely for being newer.

create or replace view public.zone_latest_metrics with (security_invoker = true) as
select distinct on (r.zone_id, r.metric_type)
  r.farm_id, r.zone_id, r.metric_type, r.value, r.unit, r.vendor_label, r.recorded_at,
  r.origin, r.source_platform, r.source_product, r.observed_on
from public.mock_readings r
where r.zone_id is not null
order by r.zone_id, r.metric_type, (r.origin = 'satellite') desc, r.recorded_at desc;

create or replace view public.zone_monthly_metrics with (security_invoker = true) as
select r.farm_id,
       r.zone_id,
       r.metric_type,
       (date_trunc('month', coalesce(r.observed_on, r.recorded_at::date)))::date as month,
       round(avg(r.value)::numeric, 3)::double precision as avg_value,
       round(min(r.value)::numeric, 3)::double precision as min_value,
       round(max(r.value)::numeric, 3)::double precision as max_value,
       count(*) as sample_count,
       bool_or(r.origin = 'satellite') as has_satellite
from public.mock_readings r
where r.zone_id is not null
group by r.farm_id, r.zone_id, r.metric_type, 4;

-- Column order changed, so this one is replaced rather than redefined in place.
drop view if exists public.vendor_feed_status;
create view public.vendor_feed_status with (security_invoker = true) as
select r.vendor_label,
       r.metric_type,
       max(coalesce(r.observed_on, r.recorded_at::date)) as last_reading_at,
       count(*) as reading_count,
       r.origin,
       max(r.source_platform) as source_platform
from public.mock_readings r
group by r.vendor_label, r.metric_type, r.origin;

grant select on public.zone_latest_metrics,
                public.zone_monthly_metrics,
                public.farm_monthly_rainfall,
                public.vendor_feed_status
  to authenticated;
