/**
 * Regenerates src/lib/data/fallback-snapshot.json from the live Supabase project.
 *
 * The app serves this bundled copy if a live read ever fails, so the dashboard
 * never shows an error in front of investors. Re-run it whenever the seed data
 * changes:  node scripts/build-fallback-snapshot.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Minimal .env.local reader so the script needs no extra dependency.
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const DEMO_EMAIL = process.env.SNAPSHOT_EMAIL ?? "farmer@example.com";
const DEMO_PASSWORD = process.env.SNAPSHOT_PASSWORD ?? "FisDemo2026!";

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { error: authError } = await supabase.auth.signInWithPassword({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
});
if (authError) throw authError;

async function fetchAll(table, columns, order) {
  let query = supabase.from(table).select(columns);
  if (order) query = query.order(order);
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

const [farms, zones, latestByZone, monthlyByZone, monthlyRainfall, vendors] = await Promise.all([
  fetchAll("farms", "*"),
  fetchAll("farm_zones", "*", "name"),
  fetchAll(
    "zone_latest_metrics",
    "zone_id, metric_type, value, unit, vendor_label, recorded_at, origin, source_platform, source_product, observed_on",
  ),
  fetchAll(
    "zone_monthly_metrics",
    "zone_id, metric_type, month, avg_value, min_value, max_value, has_satellite",
    "month",
  ),
  fetchAll("farm_monthly_rainfall", "month, total_mm, rain_days", "month"),
  fetchAll("vendor_feed_status", "*", "vendor_label"),
]);

const snapshot = {
  farm: farms[0],
  zones,
  latestByZone,
  monthlyByZone,
  monthlyRainfall,
  vendors,
  source: "fallback",
  generatedAt: new Date().toISOString(),
};

const out = resolve(root, "src/lib/data/fallback-snapshot.json");
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);

await supabase.auth.signOut();

console.log(
  `Wrote ${out}\n  farm: ${snapshot.farm.name}\n  zones: ${zones.length}` +
    `\n  latest metrics: ${latestByZone.length}\n  monthly rows: ${monthlyByZone.length}` +
    `\n  rainfall months: ${monthlyRainfall.length}\n  vendor feeds: ${vendors.length}`,
);
