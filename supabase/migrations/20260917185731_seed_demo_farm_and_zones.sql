-- Demo farm: 25.2 ha smallholding at Brakwater, ~20 km north of Windhoek.
-- The polygon is an illustrative rectangle sized to the listed hectares.
-- NOTE: 20260917191805 later shifts this geometry west onto open farmland.

with f as (
  insert into public.farms (name, region, area_ha, centroid_lat, centroid_lon, boundary_geojson, notes)
  values (
    'Brakwater Smallholding',
    'Khomas Region, Namibia',
    25.20,
    -22.440000,
    17.075000,
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(17.071939, -22.441804),
        jsonb_build_array(17.078062, -22.441804),
        jsonb_build_array(17.078062, -22.438197),
        jsonb_build_array(17.071939, -22.438197),
        jsonb_build_array(17.071939, -22.441804)
      ))
    ),
    'Modeled on a real 25.2 ha smallholding for sale at Brakwater, ~20 km north of Windhoek. Boundary is illustrative, not surveyed.'
  )
  returning id
)
insert into public.farm_zones (farm_id, name, land_use, area_ha, geojson)
select f.id, z.name, z.land_use::public.land_use, z.area_ha, z.geojson
from f,
(values
  ('Maize Block', 'cropland', 4.78,
    jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(17.071939, -22.439900),
      jsonb_build_array(17.074400, -22.439900),
      jsonb_build_array(17.074400, -22.438197),
      jsonb_build_array(17.071939, -22.438197),
      jsonb_build_array(17.071939, -22.439900))))),
  ('North Grazing Camp', 'grazing', 7.12,
    jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(17.074400, -22.439900),
      jsonb_build_array(17.078062, -22.439900),
      jsonb_build_array(17.078062, -22.438197),
      jsonb_build_array(17.074400, -22.438197),
      jsonb_build_array(17.074400, -22.439900))))),
  ('Riverbed Strip', 'degraded', 5.35,
    jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(17.071939, -22.441804),
      jsonb_build_array(17.074400, -22.441804),
      jsonb_build_array(17.074400, -22.439900),
      jsonb_build_array(17.071939, -22.439900),
      jsonb_build_array(17.071939, -22.441804))))),
  ('South Grazing Camp', 'grazing', 7.95,
    jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(17.074400, -22.441804),
      jsonb_build_array(17.078062, -22.441804),
      jsonb_build_array(17.078062, -22.439900),
      jsonb_build_array(17.074400, -22.439900),
      jsonb_build_array(17.074400, -22.441804)))))
) as z(name, land_use, area_ha, geojson);
