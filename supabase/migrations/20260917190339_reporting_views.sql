-- Aggregate views the dashboards read through. security_invoker keeps the
-- underlying RLS policies in force rather than running as the view owner.

create view public.zone_latest_metrics with (security_invoker = true) as
select distinct on (r.zone_id, r.metric_type)
  r.farm_id, r.zone_id, r.metric_type, r.value, r.unit, r.vendor_label, r.recorded_at
from public.mock_readings r
where r.zone_id is not null
order by r.zone_id, r.metric_type, r.recorded_at desc;

create view public.zone_monthly_metrics with (security_invoker = true) as
select r.farm_id,
       r.zone_id,
       r.metric_type,
       (date_trunc('month', r.recorded_at))::date as month,
       round(avg(r.value)::numeric, 3)::double precision as avg_value,
       round(min(r.value)::numeric, 3)::double precision as min_value,
       round(max(r.value)::numeric, 3)::double precision as max_value,
       count(*) as sample_count
from public.mock_readings r
where r.zone_id is not null
group by r.farm_id, r.zone_id, r.metric_type, 4;

create view public.farm_monthly_rainfall with (security_invoker = true) as
select r.farm_id,
       (date_trunc('month', r.recorded_at))::date as month,
       round(sum(r.value)::numeric, 1)::double precision as total_mm,
       count(*) filter (where r.value > 0) as rain_days
from public.mock_readings r
where r.metric_type = 'rainfall'
group by r.farm_id, 2;

create view public.vendor_feed_status with (security_invoker = true) as
select r.vendor_label,
       r.metric_type,
       max(r.recorded_at) as last_reading_at,
       count(*) as reading_count
from public.mock_readings r
group by r.vendor_label, r.metric_type;

grant select on public.zone_latest_metrics,
                public.zone_monthly_metrics,
                public.farm_monthly_rainfall,
                public.vendor_feed_status
  to authenticated;
