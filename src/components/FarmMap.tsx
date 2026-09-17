"use client";

import { useMemo, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, { Layer, NavigationControl, Popup, ScaleControl, Source } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent, StyleSpecification } from "react-map-gl/maplibre";

// MapLibre resolves its worker relative to its own bundle URL, which a Turbopack
// chunk path breaks — the fetch 404s and GeoJSON sources never load. Point it at
// the copy scripts/copy-maplibre-worker.mjs places in public/.
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
import type { FarmSnapshot, FarmZone, LandUse } from "@/lib/data/types";
import { LAND_USE_LABELS } from "@/lib/data/types";
import { latestFor } from "@/lib/analytics/risk";

export type MapLayerKey = "soil_moisture" | "ndvi" | "land_use";

const LAYER_OPTIONS: { key: MapLayerKey; label: string }[] = [
  { key: "soil_moisture", label: "Soil moisture" },
  { key: "ndvi", label: "Vegetation (NDVI)" },
  { key: "land_use", label: "Land use" },
];

/**
 * Free raster basemap — no API key and no vendor billing, matching the
 * MapLibre decision. Attribution is required by the tile provider.
 */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution:
        'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: "imagery", type: "raster", source: "imagery" }],
};

/** Interpolate between stops of [value, [r,g,b]]. */
function rampColor(value: number, stops: [number, [number, number, number]][]): string {
  if (value <= stops[0][0]) return rgb(stops[0][1]);
  const last = stops[stops.length - 1];
  if (value >= last[0]) return rgb(last[1]);

  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i];
    const [v1, c1] = stops[i + 1];
    if (value >= v0 && value <= v1) {
      const t = (value - v0) / (v1 - v0);
      return rgb([
        Math.round(c0[0] + t * (c1[0] - c0[0])),
        Math.round(c0[1] + t * (c1[1] - c0[1])),
        Math.round(c0[2] + t * (c1[2] - c0[2])),
      ]);
    }
  }
  return rgb(last[1]);
}

const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`;

/** Dry ochre through to saturated blue, 0-30% volumetric. */
const MOISTURE_STOPS: [number, [number, number, number]][] = [
  [4, [168, 108, 52]],
  [12, [214, 178, 96]],
  [20, [110, 170, 160]],
  [30, [38, 104, 168]],
];

/** Bare ground through to vigorous green, NDVI 0.05-0.75. */
const NDVI_STOPS: [number, [number, number, number]][] = [
  [0.05, [166, 124, 82]],
  [0.25, [205, 186, 108]],
  [0.45, [136, 176, 76]],
  [0.75, [32, 110, 44]],
];

const LAND_USE_COLORS: Record<LandUse, string> = {
  cropland: "rgb(120, 168, 60)",
  grazing: "rgb(198, 168, 84)",
  degraded: "rgb(172, 96, 62)",
};

interface ZoneFeatureProps {
  zoneId: string;
  name: string;
  landUse: LandUse;
  areaHa: number;
  color: string;
  soilMoisture: number | null;
  ndvi: number | null;
  readingAt: string | null;
}

export function FarmMap({
  snapshot,
  initialLayer = "soil_moisture",
  height = 420,
}: {
  snapshot: FarmSnapshot;
  initialLayer?: MapLayerKey;
  height?: number;
}) {
  const [activeLayer, setActiveLayer] = useState<MapLayerKey>(initialLayer);
  const [hovered, setHovered] = useState<{ lng: number; lat: number; props: ZoneFeatureProps } | null>(
    null,
  );

  const zoneCollection = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: snapshot.zones.map((zone) => ({
        type: "Feature" as const,
        geometry: zone.geojson,
        properties: buildZoneProps(snapshot, zone, activeLayer),
      })),
    };
  }, [snapshot, activeLayer]);

  // Frame the parcel rather than guessing a zoom: a real surveyed boundary can
  // be any shape, and this one is nearly twice as tall as it is wide.
  const bounds = useMemo(() => {
    const ring = snapshot.farm.boundary_geojson.coordinates[0];
    const lons = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, [snapshot.farm.boundary_geojson]);

  const boundaryCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: snapshot.farm.boundary_geojson,
          properties: {},
        },
      ],
    }),
    [snapshot.farm.boundary_geojson],
  );

  const onHover = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      setHovered(null);
      return;
    }
    setHovered({
      lng: event.lngLat.lng,
      lat: event.lngLat.lat,
      props: feature.properties as unknown as ZoneFeatureProps,
    });
  };

  return (
    <div className="relative overflow-hidden rounded-md border border-border" style={{ height }}>
      <Map
        initialViewState={{ bounds, fitBoundsOptions: { padding: 28 } }}
        mapStyle={SATELLITE_STYLE}
        interactiveLayerIds={["zone-fill"]}
        onMouseMove={onHover}
        onMouseLeave={() => setHovered(null)}
        // Basemap tiles come from a third party; a failure there should be
        // visible in the logs rather than a silently blank map.
        onError={(event) => console.error("[FarmMap]", event.error?.message ?? event.error)}
        style={{ width: "100%", height: "100%" }}
      >
        <Source id="zones" type="geojson" data={zoneCollection}>
          <Layer
            id="zone-fill"
            type="fill"
            paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.62 }}
          />
          <Layer
            id="zone-outline"
            type="line"
            paint={{ "line-color": "#ffffff", "line-width": 1.2, "line-opacity": 0.85 }}
          />
        </Source>

        <Source id="boundary" type="geojson" data={boundaryCollection}>
          <Layer
            id="boundary-outline"
            type="line"
            paint={{ "line-color": "#ffd782", "line-width": 2.5 }}
          />
        </Source>

        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" />

        {hovered ? (
          <Popup
            longitude={hovered.lng}
            latitude={hovered.lat}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={12}
          >
            <div className="min-w-40 text-xs text-[#1f1a14]">
              <p className="font-semibold">{hovered.props.name}</p>
              <p className="text-[11px] text-[#6b6255]">
                {LAND_USE_LABELS[hovered.props.landUse]} · {hovered.props.areaHa} ha
              </p>
              <dl className="mt-1.5 space-y-0.5">
                <Row label="Soil moisture" value={fmt(hovered.props.soilMoisture, 1, "%")} />
                <Row label="NDVI" value={fmt(hovered.props.ndvi, 2, "")} />
              </dl>
            </div>
          </Popup>
        ) : null}
      </Map>

      <div className="pointer-events-auto absolute left-3 top-3 flex gap-1 rounded-md bg-surface/95 p-1 shadow-sm ring-1 ring-border">
        {LAYER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setActiveLayer(option.key)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeLayer === option.key
                ? "bg-brand text-white"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Legend layer={activeLayer} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#6b6255]">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function fmt(value: number | null, digits: number, unit: string): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}${unit}`;
}

function buildZoneProps(snapshot: FarmSnapshot, zone: FarmZone, layer: MapLayerKey): ZoneFeatureProps {
  const moisture = latestFor(snapshot.latestByZone, zone.id, "soil_moisture");
  const ndvi = latestFor(snapshot.latestByZone, zone.id, "ndvi");

  let color = LAND_USE_COLORS[zone.land_use];
  if (layer === "soil_moisture" && moisture) color = rampColor(moisture.value, MOISTURE_STOPS);
  if (layer === "ndvi" && ndvi) color = rampColor(ndvi.value, NDVI_STOPS);

  return {
    zoneId: zone.id,
    name: zone.name,
    landUse: zone.land_use,
    areaHa: zone.area_ha,
    color,
    soilMoisture: moisture?.value ?? null,
    ndvi: ndvi?.value ?? null,
    readingAt: moisture?.recorded_at ?? ndvi?.recorded_at ?? null,
  };
}

function Legend({ layer }: { layer: MapLayerKey }) {
  if (layer === "land_use") {
    return (
      <div className="absolute bottom-3 right-3 rounded-md bg-surface/95 px-3 py-2 text-[11px] shadow-sm ring-1 ring-border">
        <p className="mb-1 font-semibold text-brand-strong">Land use</p>
        <ul className="space-y-1">
          {(Object.keys(LAND_USE_COLORS) as LandUse[]).map((use) => (
            <li key={use} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: LAND_USE_COLORS[use] }}
              />
              {LAND_USE_LABELS[use]}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const isMoisture = layer === "soil_moisture";
  const stops = isMoisture ? MOISTURE_STOPS : NDVI_STOPS;
  const gradient = `linear-gradient(to right, ${stops.map(([, c]) => rgb(c)).join(", ")})`;

  return (
    <div className="absolute bottom-3 right-3 w-44 rounded-md bg-surface/95 px-3 py-2 text-[11px] shadow-sm ring-1 ring-border">
      <p className="mb-1 font-semibold text-brand-strong">
        {isMoisture ? "Soil moisture (%)" : "NDVI"}
      </p>
      <div className="h-2 w-full rounded-sm" style={{ background: gradient }} />
      <div className="mt-1 flex justify-between text-muted tabular-nums">
        <span>{isMoisture ? "4" : "0.05"}</span>
        <span>{isMoisture ? "30" : "0.75"}</span>
      </div>
    </div>
  );
}
