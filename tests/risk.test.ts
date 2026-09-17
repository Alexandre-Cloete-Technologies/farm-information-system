import { describe, expect, it } from "vitest";
import { REFERENCE, assessFarm, bandFor } from "@/lib/analytics/risk";
import fallbackSnapshot from "@/lib/data/fallback-snapshot.json";
import type { FarmSnapshot } from "@/lib/data/types";
import { makeSnapshot } from "./fixtures";

describe("assessFarm — hand-checkable baseline", () => {
  const a = assessFarm(makeSnapshot());

  it("reports no rainfall or vegetation deficit when both sit exactly on reference", () => {
    expect(a.seasonRainfallMm).toBe(372);
    expect(a.rainfallIndex).toBe(1);
    expect(a.peakNdvi).toBe(REFERENCE.PEAK_NDVI_REFERENCE);
    expect(a.components.rainfallDeficit).toBe(0);
    expect(a.components.vegetationDeficit).toBe(0);
  });

  it("carries only the degraded-land penalty into the score", () => {
    // 0.55×0 + 0.30×0 + 0.15×0.20 = 0.03
    expect(a.components.degradationPenalty).toBe(0.2);
    expect(a.droughtRisk).toBe(3);
    expect(a.riskBand).toBe("Low");
  });

  it("scores productivity from vigour, rainfall and land condition", () => {
    // 0.55×1.0 + 0.25×1.0 + 0.20×0.80 = 0.96
    expect(a.productivityScore).toBe(96);
  });

  it("derives grazing capacity from the grazing zones only", () => {
    // 15 ha/LSU eased to 10.9 by a 96/100 productivity score; 30 ha ÷ 10.9 = 2.8 LSU
    expect(a.grazingHa).toBe(30);
    expect(a.haPerLsu).toBe(10.9);
    expect(a.grazingCapacityLsu).toBe(2.8);
  });

  it("prices the parcel off the productivity-adjusted base rate", () => {
    // 95 000 × (0.85 + 0.30 × 0.96) = 108 110 per ha, over 100 ha
    expect(a.valuePerHaNad).toBe(108_110);
    expect(a.estimatedValueNad).toBe(10_811_000);
  });
});

describe("assessFarm — edge cases", () => {
  it("caps the rainfall deficit at total failure", () => {
    const a = assessFarm(makeSnapshot({ monthlyRainfall: [] }));
    expect(a.seasonRainfallMm).toBe(0);
    expect(a.components.rainfallDeficit).toBe(1);
    expect(a.droughtRisk).toBeGreaterThanOrEqual(55);
  });

  it("does not credit a wetter-than-normal year beyond the cap", () => {
    const wet = makeSnapshot({
      monthlyRainfall: Array.from({ length: 12 }, (_, i) => ({
        month: `2026-${String(i + 1).padStart(2, "0")}-01`,
        total_mm: 200,
        rain_days: 12,
      })),
    });
    const a = assessFarm(wet);
    expect(a.components.rainfallDeficit).toBe(0);
    expect(a.productivityScore).toBeLessThanOrEqual(100);
  });

  it("survives a farm with no vegetation readings at all", () => {
    const a = assessFarm(makeSnapshot({ monthlyByZone: [] }));
    expect(a.peakNdvi).toBe(0);
    expect(a.components.vegetationDeficit).toBe(1);
    expect(Number.isFinite(a.estimatedValueNad)).toBe(true);
  });

  it("returns zero grazing capacity when nothing is classed as grazing", () => {
    const snapshot = makeSnapshot();
    const a = assessFarm({
      ...snapshot,
      zones: snapshot.zones.filter((z) => z.land_use !== "grazing"),
    });
    expect(a.grazingHa).toBe(0);
    expect(a.grazingCapacityLsu).toBe(0);
  });
});

describe("bandFor", () => {
  it.each([
    [0, "Low"],
    [24, "Low"],
    [25, "Moderate"],
    [49, "Moderate"],
    [50, "Elevated"],
    [74, "Elevated"],
    [75, "High"],
    [100, "High"],
  ])("maps %i to %s", (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe("assessFarm — bundled demo snapshot", () => {
  const snapshot = fallbackSnapshot as unknown as FarmSnapshot;

  it("produces figures in a defensible range for the demo farm", () => {
    const a = assessFarm(snapshot);
    expect(a.droughtRisk).toBeGreaterThanOrEqual(0);
    expect(a.droughtRisk).toBeLessThanOrEqual(100);
    expect(a.productivityScore).toBeGreaterThan(0);
    expect(a.seasonRainfallMm).toBeGreaterThan(150);
    expect(a.seasonRainfallMm).toBeLessThan(600);
    expect(a.estimatedValueNad).toBeGreaterThan(0);
  });

  it("is deterministic — the same snapshot always yields the same numbers", () => {
    expect(assessFarm(snapshot)).toEqual(assessFarm(snapshot));
  });
});
