-- Reclassify the Riverbed Strip from measurement rather than assumption.
--
-- It was labelled 'degraded' when the zones were drawn, on the reasoning that a
-- dry riverbed is poor land. Eight seasons of Sentinel-2 data say otherwise:
-- its mean seasonal peak NDVI is 0.467 against 0.460 for the cropland block,
-- and it was the best-performing zone on the farm in 2020/21 and 2024/25. A
-- drainage line concentrates water, which is exactly why it carries the
-- strongest vegetation in semi-arid rangeland.
--
-- This matters beyond the label: 'degraded' fed the drought-risk score as a
-- 15%-weighted land-condition penalty on 16% of the parcel.

update public.farm_zones
set land_use = 'grazing',
    name     = 'Riverbed Camp'
where name = 'Riverbed Strip';

update public.farms
set notes = notes || ' Riverbed zone reclassified from degraded to grazing on 2026-09-23 based on eight seasons of measured Sentinel-2 NDVI.';
