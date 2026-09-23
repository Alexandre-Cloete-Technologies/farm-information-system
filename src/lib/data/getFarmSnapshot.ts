import "server-only";

import { createClient } from "@/lib/supabase/server";
import fallbackSnapshot from "./fallback-snapshot.json";
import type {
  Farm,
  FarmSnapshot,
  FarmZone,
  MonthlyRainfall,
  VendorFeed,
  ZoneLatestMetric,
  ZoneMonthlyMetric,
} from "./types";

/**
 * The single read path for farm data.
 *
 * Every screen and the report API go through here, so replacing the mocked
 * `mock_readings` table with real vendor ingestion later is a backend-only
 * change — no UI touches this data source directly.
 *
 * If the live read fails for any reason (Supabase hiccup, no network at the
 * pitch venue), it falls back to a snapshot bundled into the build rather than
 * surfacing an error. `source` records which one you got.
 */
export async function getFarmSnapshot(): Promise<FarmSnapshot> {
  try {
    return await readLive();
  } catch (error) {
    console.error("[getFarmSnapshot] live read failed, using bundled snapshot", error);
    return { ...(fallbackSnapshot as unknown as FarmSnapshot), source: "fallback" };
  }
}

async function readLive(): Promise<FarmSnapshot> {
  const supabase = await createClient();

  const [farmRes, zonesRes, latestRes, monthlyRes, rainRes, vendorRes] = await Promise.all([
    supabase.from("farms").select("*").limit(1).single(),
    supabase.from("farm_zones").select("*").order("name"),
    supabase
      .from("zone_latest_metrics")
      .select(
        "zone_id, metric_type, value, unit, vendor_label, recorded_at, origin, source_platform, source_product, observed_on",
      ),
    supabase
      .from("zone_monthly_metrics")
      .select("zone_id, metric_type, month, avg_value, min_value, max_value, has_satellite")
      .order("month"),
    supabase.from("farm_monthly_rainfall").select("month, total_mm, rain_days").order("month"),
    supabase.from("vendor_feed_status").select("*").order("vendor_label"),
  ]);

  const failure = [farmRes, zonesRes, latestRes, monthlyRes, rainRes, vendorRes].find((r) => r.error);
  if (failure?.error) throw failure.error;

  const farm = farmRes.data as Farm;
  if (!farm) throw new Error("no farm rows visible");

  return {
    farm,
    zones: (zonesRes.data ?? []) as FarmZone[],
    latestByZone: (latestRes.data ?? []) as ZoneLatestMetric[],
    monthlyByZone: (monthlyRes.data ?? []) as ZoneMonthlyMetric[],
    monthlyRainfall: (rainRes.data ?? []) as MonthlyRainfall[],
    vendors: (vendorRes.data ?? []) as VendorFeed[],
    source: "live",
    generatedAt: new Date().toISOString(),
  };
}
