import { describe, expect, it } from "vitest";
import { usableNdvi } from "../scripts/build-ndvi-migration.mjs";
import { describeProvenance, isMeasured } from "@/lib/data/provenance";
import type { FarmSnapshot } from "@/lib/data/types";
import { makeSnapshot } from "./fixtures";

describe("DynaCrop NDVI mapping", () => {
  it("keeps a normal observation and rounds to four places", () => {
    expect(usableNdvi({ median: 0.26043 })).toBe(0.2604);
    expect(usableNdvi({ median: 0.5 })).toBe(0.5);
  });

  it("rejects the cloud mask rather than storing it as a measurement", () => {
    // DynaCrop masks cloud, shadow and built-up pixels with -999. Letting one
    // through would read as catastrophic vegetation loss.
    expect(usableNdvi({ median: -999 })).toBeNull();
    expect(usableNdvi({ median: -999.0 })).toBeNull();
  });

  it("rejects values outside the index's valid range", () => {
    expect(usableNdvi({ median: 1.4 })).toBeNull();
    expect(usableNdvi({ median: -1.2 })).toBeNull();
  });

  it("rejects missing values instead of coercing them to zero", () => {
    expect(usableNdvi({ median: null })).toBeNull();
    expect(usableNdvi({ median: undefined })).toBeNull();
    expect(usableNdvi(undefined)).toBeNull();
    expect(usableNdvi({})).toBeNull();
  });

  it("keeps legitimate negative readings for bare ground", () => {
    // Bare soil and rock genuinely return small negative NDVI; only the mask
    // sentinel and out-of-range values should be dropped.
    expect(usableNdvi({ median: -0.08 })).toBe(-0.08);
  });
});

describe("provenance reporting", () => {
  const snapshot = makeSnapshot();

  it("marks a metric as measured only when a zone really is", () => {
    const p = describeProvenance(snapshot);
    const ndvi = p.byMetric.find((m) => m.metric === "ndvi")!;
    const moisture = p.byMetric.find((m) => m.metric === "soil_moisture")!;

    expect(ndvi.origin).toBe("satellite");
    expect(ndvi.instrument).toBe("Sentinel-2 · NDVI");
    expect(moisture.origin).toBe("simulated");
    expect(moisture.instrument).toBeNull();
  });

  it("reports rainfall as simulated — DynaCrop has no precipitation product", () => {
    const rainfall = describeProvenance(snapshot).byMetric.find((m) => m.metric === "rainfall")!;
    expect(rainfall.origin).toBe("simulated");
    expect(rainfall.observedOn).toBeNull();
  });

  it("surfaces the latest satellite acquisition date", () => {
    expect(describeProvenance(snapshot).latestObservedOn).toBe("2026-09-17");
  });

  it("names the zones still modelled for a partly-measured metric", () => {
    const partial: FarmSnapshot = {
      ...snapshot,
      latestByZone: snapshot.latestByZone.map((r, i) =>
        r.metric_type === "ndvi" && i > 2
          ? { ...r, origin: "simulated" as const, source_platform: null, source_product: null, observed_on: null }
          : r,
      ),
    };
    const ndvi = describeProvenance(partial).byMetric.find((m) => m.metric === "ndvi")!;
    expect(ndvi.origin).toBe("satellite");
    expect(ndvi.simulatedZones.length).toBeGreaterThan(0);
  });

  it("reports per-zone measurement for the badges", () => {
    const zone = snapshot.zones[0];
    expect(isMeasured(snapshot, zone.id, "ndvi")).toBe(true);
    expect(isMeasured(snapshot, zone.id, "soil_moisture")).toBe(false);
  });

  it("treats an all-simulated farm as having no satellite data", () => {
    const allSim: FarmSnapshot = {
      ...snapshot,
      latestByZone: snapshot.latestByZone.map((r) => ({
        ...r,
        origin: "simulated" as const,
        source_platform: null,
        source_product: null,
        observed_on: null,
      })),
    };
    const p = describeProvenance(allSim);
    expect(p.anySatellite).toBe(false);
    expect(p.latestObservedOn).toBeNull();
  });
});
