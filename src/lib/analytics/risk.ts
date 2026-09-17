import type { FarmSnapshot, FarmZone, MetricType, ZoneLatestMetric } from "@/lib/data/types";

/**
 * Reference constants. These are the assumptions a valuer would argue about, so
 * they live in one place, named, rather than buried in the arithmetic.
 */
export const REFERENCE = {
  /** Long-term mean annual rainfall for the Khomas Region, mm. */
  ANNUAL_RAINFALL_NORMAL_MM: 372,
  /** Peak growing-season NDVI a healthy parcel in this region reaches. */
  PEAK_NDVI_REFERENCE: 0.62,
  /** Recommended stocking rate for Khomas rangeland in a normal year, ha per LSU. */
  HA_PER_LSU_NORMAL: 15,
  /** Indicative peri-urban smallholding land rate near Brakwater, N$ per hectare. */
  BASE_VALUE_PER_HA_NAD: 95_000,
} as const;

export type RiskBand = "Low" | "Moderate" | "Elevated" | "High";

export interface RiskAssessment {
  /** 0 = no drought stress observed, 100 = severe. */
  droughtRisk: number;
  riskBand: RiskBand;
  /** 0-100 composite of vegetation vigour, rainfall and land condition. */
  productivityScore: number;
  /** Rolling 12-month rainfall total, mm. */
  seasonRainfallMm: number;
  /** Season rainfall as a fraction of the long-term norm. */
  rainfallIndex: number;
  /** Area-weighted peak NDVI across the parcel this season. */
  peakNdvi: number;
  /** Share of the parcel classed as degraded, 0-1. */
  degradedShare: number;
  /** Sustainable stocking on the grazing zones, in large stock units. */
  grazingCapacityLsu: number;
  haPerLsu: number;
  grazingHa: number;
  valuePerHaNad: number;
  estimatedValueNad: number;
  components: {
    rainfallDeficit: number;
    vegetationDeficit: number;
    degradationPenalty: number;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Area-weighted mean of a per-zone value, skipping zones with no value. */
function areaWeighted(zones: FarmZone[], valueOf: (zone: FarmZone) => number | undefined): number {
  let weighted = 0;
  let area = 0;
  for (const zone of zones) {
    const value = valueOf(zone);
    if (value === undefined || Number.isNaN(value)) continue;
    weighted += value * zone.area_ha;
    area += zone.area_ha;
  }
  return area === 0 ? 0 : weighted / area;
}

/** Highest monthly average this season for one metric in one zone. */
function peakMonthly(snapshot: FarmSnapshot, zoneId: string, metric: MetricType): number | undefined {
  const values = snapshot.monthlyByZone
    .filter((m) => m.zone_id === zoneId && m.metric_type === metric)
    .map((m) => m.max_value);
  return values.length ? Math.max(...values) : undefined;
}

export function latestFor(
  latest: ZoneLatestMetric[],
  zoneId: string,
  metric: MetricType,
): ZoneLatestMetric | undefined {
  return latest.find((l) => l.zone_id === zoneId && l.metric_type === metric);
}

export function bandFor(droughtRisk: number): RiskBand {
  if (droughtRisk < 25) return "Low";
  if (droughtRisk < 50) return "Moderate";
  if (droughtRisk < 75) return "Elevated";
  return "High";
}

/**
 * Derives the numbers the Bank/Valuation view and the PDF report both show.
 *
 * Deliberately deterministic and season-scale: it reads the 12-month rainfall
 * total and peak growing-season NDVI rather than today's values, so running the
 * demo in the dry season doesn't make every farm look like a disaster.
 */
export function assessFarm(snapshot: FarmSnapshot): RiskAssessment {
  const { farm, zones } = snapshot;

  const seasonRainfallMm =
    Math.round(snapshot.monthlyRainfall.reduce((sum, m) => sum + m.total_mm, 0) * 10) / 10;
  const rainfallIndex = seasonRainfallMm / REFERENCE.ANNUAL_RAINFALL_NORMAL_MM;

  const peakNdvi = areaWeighted(zones, (zone) => peakMonthly(snapshot, zone.id, "ndvi"));

  const totalHa = zones.reduce((sum, z) => sum + z.area_ha, 0) || farm.area_ha;
  const degradedHa = zones.filter((z) => z.land_use === "degraded").reduce((sum, z) => sum + z.area_ha, 0);
  const degradedShare = totalHa === 0 ? 0 : degradedHa / totalHa;

  const rainfallDeficit = clamp(1 - rainfallIndex, 0, 1);
  const vegetationDeficit = clamp(1 - peakNdvi / REFERENCE.PEAK_NDVI_REFERENCE, 0, 1);
  const degradationPenalty = clamp(degradedShare, 0, 1);

  const droughtRisk = Math.round(
    100 * clamp(0.55 * rainfallDeficit + 0.3 * vegetationDeficit + 0.15 * degradationPenalty, 0, 1),
  );

  const productivityScore = Math.round(
    100 *
      clamp(
        0.55 * (peakNdvi / REFERENCE.PEAK_NDVI_REFERENCE) +
          0.25 * clamp(rainfallIndex, 0, 1.25) +
          0.2 * (1 - degradedShare),
        0,
        1,
      ),
  );

  // A poorer season means each LSU needs more hectares.
  const stockingAdjustment = clamp(productivityScore / 70, 0.6, 1.4);
  const haPerLsu = Math.round((REFERENCE.HA_PER_LSU_NORMAL / stockingAdjustment) * 10) / 10;
  const grazingHa = zones.filter((z) => z.land_use === "grazing").reduce((sum, z) => sum + z.area_ha, 0);
  const grazingCapacityLsu = Math.round((grazingHa / haPerLsu) * 10) / 10;

  const valuePerHaNad = Math.round(
    REFERENCE.BASE_VALUE_PER_HA_NAD * (0.85 + 0.3 * (productivityScore / 100)),
  );
  const estimatedValueNad = Math.round(farm.area_ha * valuePerHaNad);

  return {
    droughtRisk,
    riskBand: bandFor(droughtRisk),
    productivityScore,
    seasonRainfallMm,
    rainfallIndex: Math.round(rainfallIndex * 1000) / 1000,
    peakNdvi: Math.round(peakNdvi * 1000) / 1000,
    degradedShare: Math.round(degradedShare * 1000) / 1000,
    grazingCapacityLsu,
    haPerLsu,
    grazingHa: Math.round(grazingHa * 100) / 100,
    valuePerHaNad,
    estimatedValueNad,
    components: {
      rainfallDeficit: Math.round(rainfallDeficit * 1000) / 1000,
      vegetationDeficit: Math.round(vegetationDeficit * 1000) / 1000,
      degradationPenalty: Math.round(degradationPenalty * 1000) / 1000,
    },
  };
}

export function formatNad(value: number): string {
  return `N$ ${value.toLocaleString("en-NA", { maximumFractionDigits: 0 })}`;
}
