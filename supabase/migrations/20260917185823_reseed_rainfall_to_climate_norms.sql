-- Replace the purely-random rainfall series with one normalised to Khomas Region
-- monthly climate norms, at 85% of normal (a mildly below-average season, so the
-- Bank view's drought-risk score has something real to compute against).

delete from public.mock_readings where metric_type = 'rainfall';

select setseed(0.7);

with days as (
  select d::date as day,
         to_char(d, 'YYYY-MM') as ym,
         extract(month from d)::int as mon
  from generate_series(current_date - 364, current_date, interval '1 day') d
),
norms(mon, norm_mm) as (
  values (1, 78.0), (2, 80.0), (3, 79.0), (4, 38.0), (5, 6.0),  (6, 1.0),
         (7, 1.0),  (8, 1.0),  (9, 3.0),  (10, 12.0), (11, 28.0), (12, 45.0)
),
month_shape as (
  select d.ym,
         n.norm_mm,
         count(*) as days_present,
         extract(day from (date_trunc('month', min(d.day)) + interval '1 month - 1 day'))::int as days_in_month
  from days d
  join norms n on n.mon = d.mon
  group by d.ym, n.norm_mm
),
draws as (
  select d.day, d.ym, n.norm_mm, random() as r1, random() as r2
  from days d join norms n on n.mon = d.mon
),
wet as (
  -- a rain day is more likely in a wetter month; r2^2 skews towards light falls
  select day, ym,
         case when r1 < 0.03 + norm_mm / 220.0 then r2 * r2 + 0.05 else 0 end as raw
  from draws
),
scaled as (
  select w.day,
         case when sum(w.raw) over (partition by w.ym) > 0
              then w.raw * (m.norm_mm * 0.85 * m.days_present / m.days_in_month)
                   / sum(w.raw) over (partition by w.ym)
              else 0 end as mm
  from wet w
  join month_shape m on m.ym = w.ym
)
insert into public.mock_readings (farm_id, zone_id, vendor_label, metric_type, value, unit, recorded_at)
select f.id, null, 'Vendor 3', 'rainfall',
       round(s.mm::numeric, 1)::double precision, 'mm', s.day + time '06:00'
from public.farms f
cross join scaled s;
