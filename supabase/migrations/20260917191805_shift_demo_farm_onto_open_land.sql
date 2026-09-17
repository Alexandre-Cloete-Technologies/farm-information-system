-- The original centroid straddled the edge of a residential township, so half
-- the parcel sat over housing on the satellite basemap. Translate the whole
-- geometry ~650 m west onto open farmland. Shape, area and zone layout are
-- unchanged — only the longitude shifts.

create or replace function pg_temp.shift_polygon(geom jsonb, d_lon double precision)
returns jsonb language sql immutable as $$
  select jsonb_set(
    geom,
    '{coordinates}',
    jsonb_build_array((
      select jsonb_agg(jsonb_build_array((pt->>0)::double precision + d_lon, (pt->>1)::double precision)
                       order by ord)
      from jsonb_array_elements(geom->'coordinates'->0) with ordinality as t(pt, ord)
    ))
  );
$$;

update public.farms
set centroid_lon     = centroid_lon - 0.0065,
    boundary_geojson = pg_temp.shift_polygon(boundary_geojson, -0.0065);

update public.farm_zones
set geojson = pg_temp.shift_polygon(geojson, -0.0065);
