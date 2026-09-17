import type { FarmSnapshot, FarmZone } from "@/lib/data/types";
import { latestFor } from "./risk";

export type Severity = "ok" | "watch" | "action";

export interface ZoneCondition {
  zone: FarmZone;
  soilMoisture?: number;
  ndvi?: number;
  observedAt?: string;
  severity: Severity;
  headline: string;
}

export interface Prescription {
  zoneName: string;
  severity: Severity;
  recommendation: string;
  basis: string;
}

/** Moisture thresholds, % volumetric, tuned to semi-arid rangeland. */
const MOISTURE = { critical: 8, low: 13 } as const;
/** NDVI thresholds for vegetation vigour. */
const VIGOUR = { poor: 0.2, fair: 0.35 } as const;

export function zoneConditions(snapshot: FarmSnapshot): ZoneCondition[] {
  return snapshot.zones.map((zone) => {
    const moisture = latestFor(snapshot.latestByZone, zone.id, "soil_moisture");
    const vegetation = latestFor(snapshot.latestByZone, zone.id, "ndvi");
    const sm = moisture?.value;
    const nd = vegetation?.value;

    let severity: Severity = "ok";
    let headline = "Within expected range";

    if (sm !== undefined && sm < MOISTURE.critical) {
      severity = "action";
      headline = "Critically dry";
    } else if (nd !== undefined && nd < VIGOUR.poor) {
      severity = "action";
      headline = "Vegetation stressed";
    } else if (sm !== undefined && sm < MOISTURE.low) {
      severity = "watch";
      headline = "Drying out";
    } else if (nd !== undefined && nd < VIGOUR.fair) {
      severity = "watch";
      headline = "Below-average cover";
    }

    return {
      zone,
      soilMoisture: sm,
      ndvi: nd,
      observedAt: moisture?.recorded_at ?? vegetation?.recorded_at,
      severity,
      headline,
    };
  });
}

/**
 * Rule-based agronomy advice. Templated from the mocked readings rather than
 * real analysis — the URD's prescription engine is a later phase.
 */
export function buildPrescriptions(snapshot: FarmSnapshot): Prescription[] {
  return zoneConditions(snapshot).map(({ zone, soilMoisture, ndvi, severity }) => {
    const basis = [
      soilMoisture !== undefined ? `soil moisture ${soilMoisture.toFixed(1)}%` : null,
      ndvi !== undefined ? `NDVI ${ndvi.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    let recommendation: string;

    if (zone.land_use === "cropland") {
      if (severity === "action") {
        recommendation =
          "Irrigate within 48 hours. Hold off on top-dressing until moisture recovers above 12% — nitrogen applied to dry soil will not be taken up.";
      } else if (severity === "watch") {
        recommendation =
          "Schedule a supplementary irrigation this week and re-check before committing to a fertiliser pass.";
      } else {
        recommendation =
          "Maintain the current irrigation interval. Conditions support a standard split nitrogen application.";
      }
    } else if (zone.land_use === "grazing") {
      if (severity === "action") {
        recommendation =
          "Rest this camp. Move stock to the stronger camp and plan supplementary feed if cover does not recover within three weeks.";
      } else if (severity === "watch") {
        recommendation = "Shorten the grazing period and bring the next rotation forward by roughly a week.";
      } else {
        recommendation = "Graze on the normal rotation; cover is sufficient for the planned stocking rate.";
      }
    } else {
      recommendation =
        severity === "ok"
          ? "Continue resting. Re-assess cover at the start of the next rainy season before reintroducing stock."
          : "Keep stock off entirely. Candidate for erosion control and reseeding ahead of the November rains.";
    }

    return { zoneName: zone.name, severity, recommendation, basis };
  });
}

/** Days since the last measurable rainfall, or null if it rained today. */
export function daysSinceRain(snapshot: FarmSnapshot): number | null {
  const wetMonths = snapshot.monthlyRainfall.filter((m) => m.total_mm > 0);
  if (wetMonths.length === 0) return null;
  const lastWet = wetMonths[wetMonths.length - 1];
  const lastWetDate = new Date(lastWet.month);
  // Month granularity: count from the end of the last month that saw rain.
  const endOfMonth = new Date(lastWetDate.getFullYear(), lastWetDate.getMonth() + 1, 0);
  const diff = Date.now() - endOfMonth.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}
