import type { FarmSnapshot, FarmZone, GeoJsonPolygon } from "@/lib/data/types";

const SQUARE: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [17, -22],
      [17.01, -22],
      [17.01, -22.01],
      [17, -22.01],
      [17, -22],
    ],
  ],
};

function zone(id: string, name: string, land_use: FarmZone["land_use"], area_ha: number): FarmZone {
  return { id, farm_id: "farm-1", name, land_use, area_ha, geojson: SQUARE };
}

/**
 * A deliberately round synthetic farm: exactly-normal rainfall, exactly-reference
 * NDVI and a 20% degraded share, so every derived figure can be hand-checked.
 */
export function makeSnapshot(overrides: Partial<FarmSnapshot> = {}): FarmSnapshot {
  const zones = [
    zone("z1", "Crop Block", "cropland", 50),
    zone("z2", "Grazing Camp", "grazing", 30),
    zone("z3", "Riverbed", "degraded", 20),
  ];

  return {
    farm: {
      id: "farm-1",
      name: "Test Farm",
      region: "Khomas Region, Namibia",
      area_ha: 100,
      centroid_lat: -22.005,
      centroid_lon: 17.005,
      boundary_geojson: SQUARE,
      notes: null,
    },
    zones,
    latestByZone: zones.flatMap((z) => [
      {
        zone_id: z.id,
        metric_type: "soil_moisture" as const,
        value: 14,
        unit: "%",
        vendor_label: "Vendor 1",
        recorded_at: "2026-09-17T09:30:00Z",
        origin: "simulated" as const,
        source_platform: null,
        source_product: null,
        observed_on: null,
      },
      {
        zone_id: z.id,
        metric_type: "ndvi" as const,
        value: 0.3,
        unit: "index",
        vendor_label: "DynaCrop · Sentinel-2",
        recorded_at: "2026-09-17T10:15:00Z",
        origin: "satellite" as const,
        source_platform: "Sentinel-2",
        source_product: "NDVI",
        observed_on: "2026-09-17",
      },
    ]),
    // Peak NDVI of exactly the reference value in every zone.
    monthlyByZone: zones.map((z) => ({
      zone_id: z.id,
      metric_type: "ndvi" as const,
      month: "2026-02-01",
      avg_value: 0.5,
      min_value: 0.4,
      max_value: 0.509,
      has_satellite: true,
    })),
    // 12 × 31 mm = 372 mm, exactly the long-term norm.
    monthlyRainfall: Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, "0")}-01`,
      total_mm: 31,
      rain_days: 4,
    })),
    vendors: [
      {
        vendor_label: "Vendor 1",
        metric_type: "soil_moisture",
        last_reading_at: "2026-09-17T09:30:00Z",
        reading_count: 1460,
        origin: "simulated",
        source_platform: null,
      },
      {
        vendor_label: "DynaCrop · Sentinel-2",
        metric_type: "ndvi",
        last_reading_at: "2026-09-17",
        reading_count: 572,
        origin: "satellite",
        source_platform: "Sentinel-2",
      },
    ],
    source: "live",
    generatedAt: "2026-09-17T12:00:00Z",
    ...overrides,
  };
}
