/**
 * Pulls real Sentinel-2 NDVI history from DynaCrop for the registered zones and
 * writes it to a JSON file for the loader to ingest.
 *
 *   DC_KEY=<api key> node scripts/fetch-dynacrop-ndvi.mjs [outfile]
 *
 * The key comes from the environment and is never written to disk. DynaCrop's
 * processing model is queue-and-poll: POST creates a request, then you poll it
 * until `status` is `completed` before the result is readable.
 *
 * Trial plan limits this is written around: 5 requests/minute and only one
 * request processing at a time, so calls are serialised with a delay.
 */
import { writeFileSync } from "node:fs";

const KEY = process.env.DC_KEY;
if (!KEY) throw new Error("Set DC_KEY to the DynaCrop API key");

const BASE = "https://api.dynacrop.space/api/v3";
const OUT = process.argv[2] ?? "dynacrop-ndvi.json";
const DATE_FROM = "2018-01-01";
const DATE_TO = new Date().toISOString().slice(0, 10);

/** Zone name -> DynaCrop polygon id, registered from our survey geometry. */
export const REGISTERED_ZONES = {
  "Maize Block": "71983c2d-6520-5bcb-942e-0d12782b0f17",
  "South Grazing Camp": "d95fa693-8d57-5f7d-b750-d1c3b66afbed",
  "Riverbed Strip": "6e5ab839-495d-5dfa-8969-d2c8ebec8ac0",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ApiKey: KEY,
      "Content-Type": "application/json",
      "User-Agent": "FIS-MVP/0.1",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 400);
  }
  if (res.status >= 400) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

/** Queue a time series and poll until it renders. */
async function timeSeries(polygonId) {
  const created = await call("/time_series/", {
    method: "POST",
    body: JSON.stringify({
      polygon_id: polygonId,
      product: ["Sentinel-2", "NDVI"],
      date_from: DATE_FROM,
      date_to: DATE_TO,
    }),
  });

  for (let attempt = 0; attempt < 90; attempt++) {
    await sleep(5000);
    const current = await call(`/time_series/${created.id}/`);
    if (current.status === "completed") return current.result.time_series;
    if (current.status === "error") throw new Error(`render failed: ${current.error}`);
    if (current.status === "no_data") return {};
  }
  throw new Error(`timed out waiting for ${created.id}`);
}

const out = { fetchedAt: new Date().toISOString(), dateFrom: DATE_FROM, dateTo: DATE_TO, zones: {} };

for (const [name, polygonId] of Object.entries(REGISTERED_ZONES)) {
  process.stderr.write(`${name} ... `);
  const series = await timeSeries(polygonId);
  const dates = Object.keys(series).sort();
  out.zones[name] = { polygonId, observations: series };
  process.stderr.write(`${dates.length} observations ${dates[0]} -> ${dates.at(-1)}\n`);
  await sleep(13000); // stay under 5 req/min
}

writeFileSync(OUT, JSON.stringify(out, null, 1));
console.error(`\nwrote ${OUT}`);
