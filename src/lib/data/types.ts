export type UserRole = "farmer" | "agronomist" | "bank_officer";
export type MetricType = "soil_moisture" | "ndvi" | "rainfall";
export type LandUse = "cropland" | "grazing" | "degraded";

export interface Profile {
  id: string;
  display_name: string;
  role: UserRole;
  organisation: string | null;
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Farm {
  id: string;
  name: string;
  region: string;
  area_ha: number;
  centroid_lat: number;
  centroid_lon: number;
  boundary_geojson: GeoJsonPolygon;
  notes: string | null;
}

export interface FarmZone {
  id: string;
  farm_id: string;
  name: string;
  land_use: LandUse;
  area_ha: number;
  geojson: GeoJsonPolygon;
}

export interface ZoneLatestMetric {
  zone_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  vendor_label: string;
  recorded_at: string;
}

export interface ZoneMonthlyMetric {
  zone_id: string;
  metric_type: MetricType;
  month: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}

export interface MonthlyRainfall {
  month: string;
  total_mm: number;
  rain_days: number;
}

export interface VendorFeed {
  vendor_label: string;
  metric_type: MetricType;
  last_reading_at: string;
  reading_count: number;
}

/**
 * Everything every dashboard view needs, in one shape.
 *
 * `source` records whether this came from Supabase or the bundled snapshot, so
 * the UI can show a quiet indicator without ever breaking mid-pitch.
 */
export interface FarmSnapshot {
  farm: Farm;
  zones: FarmZone[];
  latestByZone: ZoneLatestMetric[];
  monthlyByZone: ZoneMonthlyMetric[];
  monthlyRainfall: MonthlyRainfall[];
  vendors: VendorFeed[];
  source: "live" | "fallback";
  generatedAt: string;
}

export const METRIC_LABELS: Record<MetricType, string> = {
  soil_moisture: "Soil moisture",
  ndvi: "Vegetation index (NDVI)",
  rainfall: "Rainfall",
};

export const LAND_USE_LABELS: Record<LandUse, string> = {
  cropland: "Cropland",
  grazing: "Grazing",
  degraded: "Degraded",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  farmer: "Farmer",
  agronomist: "Agronomist",
  bank_officer: "Bank / Valuation Officer",
};
