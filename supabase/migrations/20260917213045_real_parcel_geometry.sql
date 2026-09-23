-- Replace the drawn rectangle with a real surveyed parcel.
--
-- Boundary is OpenStreetMap way 701878889 (landuse=farmland) at Brakwater,
-- ~20 km north of Windhoek: 21.58 ha across 31 vertices, including the notch
-- where a homestead is carved out of the northern edge. The previous geometry
-- was an illustrative rectangle sized to a listing, which read as synthetic on
-- a satellite basemap.
--
-- Management zones are a Voronoi partition of that boundary, so fence lines
-- meet at natural angles and follow the survey instead of forming a grid.
-- Zone areas are computed with the same spherical formula as the parcel and
-- sum to it exactly.

update public.farms
set area_ha          = 21.58,
    centroid_lon     = 17.070447,
    centroid_lat     = -22.439769,
    boundary_geojson = '{"type":"Polygon","coordinates":[[[17.070403,-22.437491],[17.069676,-22.43695],[17.069204,-22.436772],[17.068876,-22.436719],[17.068775,-22.437196],[17.068681,-22.437774],[17.068489,-22.438725],[17.068452,-22.439082],[17.068439,-22.439536],[17.068482,-22.440009],[17.068581,-22.440574],[17.068736,-22.441087],[17.068922,-22.441532],[17.069526,-22.442819],[17.069888,-22.4428],[17.072456,-22.442603],[17.072329,-22.441188],[17.07216,-22.438037],[17.072122,-22.437559],[17.071964,-22.43766],[17.07183,-22.437739],[17.071696,-22.437828],[17.071599,-22.437938],[17.071449,-22.438057],[17.071282,-22.438086],[17.071106,-22.438061],[17.071036,-22.437957],[17.071004,-22.437833],[17.070971,-22.437719],[17.070725,-22.437665],[17.070526,-22.4376],[17.070403,-22.437491]]]}'::jsonb,
    notes            = 'Boundary from OpenStreetMap way 701878889 (landuse=farmland), Brakwater, ~20 km north of Windhoek. Real surveyed outline; management zones are a derived subdivision.';

update public.farm_zones
set area_ha = 5.01,
    geojson = '{"type":"Polygon","coordinates":[[[17.070403,-22.437491],[17.069676,-22.43695],[17.069204,-22.436772],[17.068876,-22.436719],[17.068775,-22.437196],[17.068681,-22.437774],[17.068679,-22.437785],[17.071539,-22.439301],[17.072221,-22.439182],[17.07216,-22.438037],[17.072122,-22.437559],[17.071964,-22.43766],[17.07183,-22.437739],[17.071696,-22.437828],[17.071599,-22.437938],[17.071449,-22.438057],[17.071282,-22.438086],[17.071106,-22.438061],[17.071036,-22.437957],[17.071004,-22.437833],[17.070971,-22.437719],[17.070725,-22.437665],[17.070526,-22.4376],[17.070403,-22.437491]]]}'::jsonb
where name = 'Maize Block';

update public.farm_zones
set area_ha = 6.14,
    geojson = '{"type":"Polygon","coordinates":[[[17.069963,-22.44072],[17.071539,-22.439301],[17.068679,-22.437785],[17.068489,-22.438725],[17.068452,-22.439082],[17.068439,-22.439536],[17.068482,-22.440009],[17.06855,-22.440398],[17.069963,-22.44072]]]}'::jsonb
where name = 'North Grazing Camp';

update public.farm_zones
set area_ha = 6.92,
    geojson = '{"type":"Polygon","coordinates":[[[17.071539,-22.439301],[17.069963,-22.44072],[17.070856,-22.442726],[17.072456,-22.442603],[17.072329,-22.441188],[17.072221,-22.439182],[17.071539,-22.439301]]]}'::jsonb
where name = 'South Grazing Camp';

update public.farm_zones
set area_ha = 3.51,
    geojson = '{"type":"Polygon","coordinates":[[[17.069963,-22.44072],[17.06855,-22.440398],[17.068581,-22.440574],[17.068736,-22.441087],[17.068922,-22.441532],[17.069526,-22.442819],[17.069888,-22.4428],[17.070856,-22.442726],[17.069963,-22.44072]]]}'::jsonb
where name = 'Riverbed Strip';

