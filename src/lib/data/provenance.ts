import type { FarmSnapshot, MetricType, ReadingOrigin } from "./types";

/**
 * Required by the Copernicus licence wherever DynaCrop outputs are published.
 * Not optional decoration — it is a condition of using Sentinel data.
 */
export const COPERNICUS_ATTRIBUTION =
  "Contains modified Copernicus Sentinel data, processed by DynaCrop (World from Space).";

export interface MetricProvenance {
  metric: MetricType;
  origin: ReadingOrigin;
  /** e.g. "Sentinel-2 · NDVI". Null when simulated. */
  instrument: string | null;
  /** Latest satellite acquisition date, if any. */
  observedOn: string | null;
  /** Zone names carrying measured data for this metric. */
  measuredZones: string[];
  /** Zone names still modelled for this metric. */
  simulatedZones: string[];
}

export interface Provenance {
  byMetric: MetricProvenance[];
  anySatellite: boolean;
  /** Most recent satellite acquisition across the farm. */
  latestObservedOn: string | null;
  measuredCount: number;
  totalCount: number;
}

/**
 * Works out, per metric, which zones are measured and which are modelled.
 *
 * One function feeding both the dashboard and the PDF, so a lender can never
 * be shown two different accounts of where a figure came from.
 */
export function describeProvenance(snapshot: FarmSnapshot): Provenance {
  const zoneName = new Map(snapshot.zones.map((z) => [z.id, z.name]));
  const metrics: MetricType[] = ["soil_moisture", "ndvi", "rainfall"];

  const byMetric = metrics.map<MetricProvenance>((metric) => {
    const readings = snapshot.latestByZone.filter((r) => r.metric_type === metric);

    const measured = readings.filter((r) => r.origin === "satellite");
    const simulated = readings.filter((r) => r.origin !== "satellite");

    const observedDates = measured
      .map((r) => r.observed_on)
      .filter((d): d is string => Boolean(d))
      .sort();

    const platform = measured[0]?.source_platform;
    const product = measured[0]?.source_product;

    return {
      metric,
      // A metric counts as measured only if at least one zone really is.
      origin: measured.length > 0 ? "satellite" : "simulated",
      instrument: platform && product ? `${platform} · ${product}` : null,
      observedOn: observedDates.at(-1) ?? null,
      measuredZones: measured.map((r) => zoneName.get(r.zone_id) ?? "—").sort(),
      simulatedZones: simulated.map((r) => zoneName.get(r.zone_id) ?? "—").sort(),
    };
  });

  const allObserved = byMetric
    .map((m) => m.observedOn)
    .filter((d): d is string => Boolean(d))
    .sort();

  const measuredCount = byMetric.reduce((n, m) => n + m.measuredZones.length, 0);
  const totalCount = byMetric.reduce(
    (n, m) => n + m.measuredZones.length + m.simulatedZones.length,
    0,
  );

  return {
    byMetric,
    anySatellite: measuredCount > 0,
    latestObservedOn: allObserved.at(-1) ?? null,
    measuredCount,
    totalCount,
  };
}

/** True when this zone's reading for the metric came from a satellite. */
export function isMeasured(
  snapshot: FarmSnapshot,
  zoneId: string,
  metric: MetricType,
): boolean {
  return snapshot.latestByZone.some(
    (r) => r.zone_id === zoneId && r.metric_type === metric && r.origin === "satellite",
  );
}

export function formatObservedOn(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
