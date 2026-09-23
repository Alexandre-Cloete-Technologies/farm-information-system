# DynaCrop integration — handover

Written 23 Sept 2026, overnight, ahead of the AgriBank demo.

## What is real now

Vegetation (NDVI) for **three of the four zones** is real Sentinel-2 data from
DynaCrop: **1,714 observations, 2 Jan 2018 to 22 Sep 2026**, at a 3–5 day
cadence. Soil moisture and rainfall are still simulated.

| Metric | Status | Why |
|---|---|---|
| Vegetation index (NDVI) | **Sentinel-2, real** | Works on the trial plan |
| Soil moisture | Simulated | Needs Sentinel-1 (SMI) — commercial tier only |
| Rainfall | Simulated | DynaCrop has no precipitation product on any tier |

**North Grazing Camp is still simulated.** The trial allows three registered
fields and the farm has four. I picked the other three so every land-use type
has measured data, and the leftover zone demonstrates the marking.

Registered polygon ids are in `scripts/fetch-dynacrop-ndvi.mjs`.

## What to say in the room

Two of three feeds are still modelled. The dashboard and PDF both say so
explicitly. Don't describe this as a live satellite feed — say *"vegetation is
real satellite data going back to 2018; soil moisture and rainfall are modelled
until we move off the trial plan."*

The strongest material is the record itself: the **2018/19 drought** shows
clearly, with peak NDVI of 0.30 and 0.23 on two zones against a nine-season norm
of 0.51.

## Two defects the real data exposed

**The vegetation reference was wrong.** `PEAK_NDVI_REFERENCE` was `0.62`, a
number I guessed when there was no real data. The satellite record shows that is
the *best season in nine years*. Every normal season was being scored against an
exceptional one. It is now `0.509`, the measured mean seasonal peak across 24
season-zone pairs.

**Loading history broke the scoring.** With eight seasons in the table, the peak
NDVI calculation was taking the best month *ever observed* instead of this
season's, which saturated productivity at 100/100 and pushed drought risk down.
It is now windowed to 12 months, with a regression test.

## Known limitations

- **Productivity reads high (97/100).** The score compares this season's peak
  against the eight-year *mean*, so any at-or-above-average season scores near
  the top. It is arithmetically correct and the composition table shows the
  working, but for a lender a percentile against the farm's own history would be
  more honest. Worth doing before the next lender conversation.
- **Ingestion is a batch job, not a scheduled service.** The planned Supabase
  Edge Function on `pg_cron` is not built. Refreshing means re-running two
  scripts by hand (below). This was the deliberate trade to get real data in
  safely overnight; it is the first thing to finish in Phase 2.
- **The trial expires 22 Oct 2026.** After that the API stops answering. The
  ingested history stays in the database and the dashboard keeps working.

## Refreshing the data

```bash
DC_KEY=<api key> node scripts/fetch-dynacrop-ndvi.mjs fetched.json
node scripts/build-ndvi-migration.mjs fetched.json supabase/migrations/<timestamp>_ndvi_refresh.sql
# apply the migration, then:
npm run seed:snapshot   # so the offline fallback matches
```

The key is read from the environment and never written to a file. It must never
reach the browser bundle — there is no `NEXT_PUBLIC_` variable for it, and there
should not be.

**Rotate the API key.** It was shared as a screenshot in chat, so treat it as
exposed.

## Safety rails worth knowing about

- The `pg_cron` random walk **skips any zone/metric with satellite readings**,
  so the simulation can never overwrite or extend a measurement.
- `zone_latest_metrics` ranks satellite above simulated. Imagery always lags, so
  without this a model writing with `now()` would outrank a real observation for
  being newer.
- Re-running the backfill is safe: a unique index on
  `(zone, metric, platform, product, observed_on)` makes it idempotent.

## The riverbed reclassification

The zone previously labelled "Riverbed Strip / degraded" is now "Riverbed Camp /
grazing". It was classified from assumption; eight seasons of measurement show it
matching the cropland block (0.467 vs 0.460 mean seasonal peak) and beating it in
2020/21 and 2024/25. A drainage line concentrates water, so this is what you would
expect in semi-arid rangeland.

This mattered beyond the label — "degraded" was feeding a 15%-weighted land
condition penalty into the drought-risk score.

If asked, this is a good story: an assumption in the model was corrected by
measurement, which is the entire argument for the product.
