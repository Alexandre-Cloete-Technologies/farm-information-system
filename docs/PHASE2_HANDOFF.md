# Phase 2 handoff — DynaCrop satellite data

Status as of 24 September 2026. Live at
<https://farm-information-system.netlify.app>.

## In short

Real satellite vegetation data (NDVI from DynaCrop, Sentinel-2) now covers
**three of the farm's four management zones, from January 2018 to 22 September
2026**. Soil moisture and rainfall are **still simulated**. Every figure on the
dashboards and in the PDF report is labelled "Satellite" or "Simulated".

The data was loaded as a **one-off import**. Automatic, scheduled updates are
**not built yet**, so the satellite data will not refresh on its own.

---

## 1. What was built

### How it works, end to end

1. The farm's management zones were registered with DynaCrop as "fields", using
   our own surveyed boundaries.
2. A script asks DynaCrop for each field's vegetation history. DynaCrop queues
   the request, processes it, and returns statistics for every satellite pass.
   ([scripts/fetch-dynacrop-ndvi.mjs](../scripts/fetch-dynacrop-ndvi.mjs))
3. A second script discards unusable readings and turns the rest into a
   database migration. ([scripts/build-ndvi-migration.mjs](../scripts/build-ndvi-migration.mjs))
4. The migration loads the readings into the database, each tagged with where it
   came from: satellite, product, and the date the satellite observed the field.
5. The dashboards and PDF report read **only from our database**. They never
   contact DynaCrop, so a slow or unavailable DynaCrop cannot break a demo.

**Where it runs and how it is scheduled:** steps 2–4 are run **by hand** from a
developer's computer. They are **not scheduled**. The planned automatic service
(a Supabase function on a timer, with the API key held in Supabase's secret
store) has not been built. The API key is typed in at run time; it is not stored
in the code, the repository or the website.

### DynaCrop endpoints used

| Purpose | Endpoint |
|---|---|
| Register a field | `POST /api/v3/polygons/` |
| Check which satellites are active for a field | `GET /api/v3/polygons/{id}/` |
| Request vegetation history | `POST /api/v3/time_series/`, product `[Sentinel-2, NDVI]` |
| Collect the result (polled until ready) | `GET /api/v3/time_series/{id}/` |
| Read account limits | `GET /api/v3/user/` |

For each zone and date we store the **median** NDVI across the field.

Tried and **not available**: soil moisture, product `[Sentinel-1, SMI]`. The API
rejected it as "not enabled" for our fields, and it could not be switched on.

### What is real and what is simulated

| Measurement | Zones | Source |
|---|---|---|
| Vegetation (NDVI) | Maize Block, South Grazing Camp, Riverbed Camp | **Satellite** (Sentinel-2) |
| Vegetation (NDVI) | North Grazing Camp | Simulated |
| Soil moisture | All four | Simulated |
| Rainfall | Whole farm | Simulated |

How this is shown:

- **Every dashboard** has a "Data sources" strip listing each measurement, its
  source, the date of the latest satellite observation, and how many zones are
  still simulated.
- **Farmer and Agronomist views** label each zone "Satellite" or "Simulated".
- **Bank view** has a "What this score is built from" panel, marking each input.
- **PDF report**: the header states "Satellite data to 22 Sept 2026"; a "Data
  provenance" table lists each measurement's source, instrument and latest
  observation; and it names the zones still modelled.
- Both carry the acknowledgement the satellite data licence requires:
  *"Contains modified Copernicus Sentinel data, processed by DynaCrop."*

### Historical data

**1,714 satellite readings, 2 January 2018 to 22 September 2026** (572, 569 and
573 per zone). DynaCrop has data back to 2017; we started at 2018.

### How it feeds the scores

**Drought risk** = 55% rainfall shortfall + 30% vegetation shortfall + 15% share
of degraded land.

- *Rainfall*: simulated.
- *Vegetation*: this season's peak NDVI (last 12 months, averaged across zones by
  area — three real, one simulated), compared with **this farm's own average
  seasonal peak over eight seasons: 0.509**. The previous reference of 0.62 was
  a guess; the satellite record shows it was the best season in nine years.
- *Degraded land*: now 0%. The riverbed zone was reclassified after the satellite
  record showed it is not degraded (see section 3).

> **Today the drought-risk score is 10 out of 100, and all 10 points come from
> the simulated rainfall.** This season's vegetation (0.523) is above the farm's
> eight-season average, so the vegetation part currently adds nothing. The real
> data is being used — it is simply not raising the score this season.

**Productivity** (97/100) = 55% vegetation (mostly real), 25% rainfall
(simulated), 20% land condition.

**Valuation** applies an **assumed** land rate of N$95,000 per hectare, adjusted
up or down by up to 15% according to productivity. The base rate is an
assumption, not data.

The eight-year history is currently used **only to set the vegetation
reference**. The scores do not yet compare this season against the farm's full
range of seasons; that is recommended (section 4).

### One field per zone, not one for the whole parcel

Each management zone was registered separately, because the dashboards show
readings per zone. The trial plan allows **three fields**; the farm has four
zones. **North Grazing Camp was not registered** and stays simulated. The three
registered zones were chosen so each land use (cropland, grazing, riverbed) has
real data.

---

## 2. Changes since Phase 1

### Database

All changes are versioned migrations in
[supabase/migrations/](../supabase/migrations/), and the file names match the
versions recorded in the live database.

| Migration | What it does |
|---|---|
| `20260923042249_reading_provenance` | Records on every reading whether it is satellite or simulated, plus satellite, product and observation date. Prevents duplicate satellite readings. |
| `20260923042321_tick_skips_satellite_metrics` | Stops the simulated "live tick" from ever touching satellite data. |
| `20260923042523_real_ndvi_backfill` | Removes simulated vegetation for the three zones and loads the real history. |
| `20260923042950_views_expose_provenance` | Passes the source through to the dashboards; a satellite reading always wins over a simulated one. |
| `20260923043004_reclassify_riverbed_from_measurement` | Renames the riverbed zone "Riverbed Camp" and changes it from degraded to grazing. |

No new tables. One new data type (reading source). Three views changed. No new
scheduled jobs.

### Simulated "live tick"

Still runs every two minutes. It still moves soil moisture in every zone and
vegetation for North Grazing Camp, and **never touches satellite data** (checked:
0 satellite readings modified). On screen, simulated numbers move and satellite
numbers don't — which is correct, as satellite images arrive every few days.

### Offline fallback

Still works. The bundled copy used when the database is unreachable was
regenerated from the real data and includes the satellite/simulated labels. It is
a snapshot as of 23 September 2026 and must be regenerated after any data refresh.

### Other application changes

- Trend charts now show the last 13 months; with eight years loaded they had
  become unreadable.
- Scores now use the last 12 months only; with eight years loaded they were
  comparing this season against the best month on record.

### Tests: 21 → 33

The 12 new tests cover:

- **Converting DynaCrop readings (5):** cloud-masked readings (DynaCrop's `-999`
  marker) are rejected; impossible values are rejected; missing values are not
  turned into zeros; genuine negative readings from bare ground are kept.
- **Labelling (6):** a measurement counts as "satellite" only if a zone really is;
  rainfall is always reported as simulated; the latest observation date is
  correct; partly-measured measurements name the simulated zones; per-zone labels;
  an all-simulated farm reports no satellite data.
- **Scoring (1):** scores use this season, not the best month in the history.

Not covered by automated tests: the import script's network behaviour (queueing,
polling, rate limits).

### Deployment

**Live on Netlify.** All three roles and the PDF report were checked on the live
site on 23–24 September.

**Unfinished:** scheduled updates; soil moisture; the fourth zone; real rainfall;
scoring against the farm's own range; seasonal alert thresholds (see section 3).

---

## 3. Findings and limitations

### How well DynaCrop fits a semi-arid grazing parcel

| | Product | Finding |
|---|---|---|
| **Works** | Vegetation (NDVI, Sentinel-2) | Working, dense history. |
| **Good fit, unavailable** | Soil moisture (SMI, Sentinel-1) | Radar, so unaffected by cloud; DynaCrop recommends it for fields with NDVI up to 0.6, which fits this parcel. Not enabled on our plan. |
| **Good fit, not tried** | Sparse-vegetation index (MSAVI2) | Designed for low vegetation cover. |
| **Possible later** | Soil organic carbon | Needs bare soil; the dry-season riverbed may qualify. |
| **Meaningless here** | Crop-season reports (growth overview, growth change, growth variability, vegetation classes, field summary) | Assume a sown crop with a season. Grazing land has none. |
| **Meaningless here** | Yellow rust index | Wheat disease. |
| **Meaningless here** | Variable-rate / prescription zoning | Built for row crops. |
| **Unlikely to help** | Dense-canopy indices (LAI, FAPAR, chlorophyll and water content, red-edge) | Designed for full crop canopies. Not tested. |
| **Not offered** | Rainfall | DynaCrop has no rainfall product on any plan. |

**Two things the real data corrected:**

- The **riverbed zone** had been assumed degraded. Its measured record is as
  productive as the cropland (average seasonal peak 0.467 vs 0.460), and it was
  the best zone on the farm in 2020/21 and 2024/25 — a drainage line collects
  water. It was reclassified, which removed a land-condition penalty from the
  drought score.
- The **"healthy vegetation" reference** had been set at 0.62. That was the best
  of nine seasons; the real average is 0.509.

### Image frequency actually observed

Across 2018–2026, for each zone, counting usable readings after DynaCrop's cloud
filtering:

- **Usually every 5 days** — about 60–73 readings a year (73 in 2025).
- **Longest gaps: 20 days**, once 35 days (Maize Block, late Dec 2020 to end Jan
  2021). Each zone had 4 gaps longer than 15 days, **all in the rainy season
  (December–April)** — cloud.
- Dry-season coverage is dense and regular.
- DynaCrop's cloud setting on our fields was 50% maximum cover (their docs give
  30% as the default). We did not change it.

In practice the "latest available" reading is 0–5 days old, and up to about three
weeks old during the rainy season.

### Account limits

Read from the account on 23 September 2026:

| | Trial account |
|---|---|
| Plan | "Test – free" |
| Valid | 22 Sep 2026 – **22 Oct 2026** |
| Fields | maximum 3 (all 3 used) |
| Area | maximum 100 ha (15.4 ha used) |
| Speed | 5 requests per minute |
| Processing | 1 request at a time |
| Satellites | Sentinel-2 only |

DynaCrop's published plans (from their documentation, September 2026):

| Plan | Terms | Price |
|---|---|---|
| Free trial | 30 days, 100 ha, up to 3 fields, 5 requests/min | Free |
| Journey | Non-commercial only; all services; 500 ha; up to 3 months; 5 h support | Not published |
| Commercial | Unlimited area; yearly subscription, priced by registered area | Not published |

They also publish **example** prices for PlanetScope imagery bought in batches:
from €3.50/ha (under 5 ha) down to €1.50/ha (over 1,000 ha), with a 4 ha
minimum, and state that actual rates depend on the plan. Whether this applies to
the Sentinel data we use is **unknown**. Integration consulting is charged at
€50/hour after a free first 30 minutes.

**Unknown — confirm with DynaCrop (sales@worldfrom.space):**
the price of the Sentinel-based service; **which plan enables Sentinel-1 soil
moisture**; field limits on the Journey plan; whether paid plans raise the rate
limit.

A paid plan would allow the fourth zone and a longer period, and *may* allow soil
moisture — not confirmed.

### Known issues and demo risks

1. **The drought-risk score is driven entirely by simulated rainfall today.** If
   asked "what drives the 10?", the honest answer is the modelled rainfall.
2. **Every zone shows "stressed" or "critically dry"**, and the agronomy advice
   says to rest every grazing camp and irrigate the maize block within 48 hours.
   The alert thresholds were fixed before real data existed. This parcel's
   vegetation sits at 0.15–0.18 at the end of every dry season (2018–2026), below
   the 0.20 threshold, so every zone flags every September. Explain it as the end
   of the dry season; the fix is thresholds relative to the season.
3. **Productivity reads 97/100**, which flatters a semi-arid smallholding. It
   compares this season with the average season, not with the full range.
4. **Satellite data stops at 22 September 2026** until the import is re-run. After
   22 October the trial ends and no new data can be fetched; history already
   loaded stays.
5. **North Grazing Camp is simulated.** It is labelled, but be ready to explain
   why (the trial allows three fields).
6. The **soil-moisture figure is a simulated percentage.**
7. Simulated figures move every two minutes; satellite figures do not. Expected,
   but can prompt questions.
8. **The DynaCrop API key was shared as a screenshot** and should be replaced.

### Before a demo

- Run [docs/pre-pitch-checklist.md](pre-pitch-checklist.md).
- Confirm the database is not paused (free projects pause after a week idle).
- Check the "Data sources" strip shows the expected latest observation date.
- Download the PDF from the **live** site and check its provenance table.
- Rehearse answers to issues 1, 2 and 5 above.

---

## 4. Effort

**Basis:** no time log was kept. **Every line below is an estimate** of
professional effort for the scope delivered, on the same basis as the Phase 1
scope and effort document.

### Delivered in this phase

| Workstream | Hours | N$ at N$350/h |
|---|---:|---:|
| DynaCrop research and fit assessment (API, products, pricing) | 4.0 | 1,400 |
| Phase 2 plan and costed proposal, incl. revision | 2.0 | 700 |
| Account checks, field registration, capability testing | 2.0 | 700 |
| Data-source tracking in the database | 3.0 | 1,050 |
| Import scripts (queue-and-poll client, rate limiting, cloud filtering) | 4.0 | 1,400 |
| Historical import 2018–2026 and verification | 2.0 | 700 |
| Scoring corrections from measured data | 3.0 | 1,050 |
| Dashboard satellite/simulated labelling | 4.0 | 1,400 |
| PDF report data-source section | 2.0 | 700 |
| Automated tests (+12) | 2.0 | 700 |
| Offline fallback regeneration | 0.5 | 175 |
| Deployment and live verification, incl. chart fix | 2.0 | 700 |
| Documentation and handover | 2.5 | 875 |
| **Total** | **33.0** | **11,550** |

The first two lines are research and proposal work; whether they are billed or
treated as pre-sales is a commercial decision.

### Compared with the Phase 2 quote

The Phase 2 proposal quoted **54 hours (N$18,900)** for the full integration.
This phase delivered part of that scope in 33 hours. Remaining to complete it:

| Remaining workstream | Hours | N$ at N$350/h |
|---|---:|---:|
| Scheduled automatic updates, with monitoring | 10.0 | 3,500 |
| Scoring against the farm's own range; seasonal alert thresholds | 5.0 | 1,750 |
| Soil moisture (SMI) import and relabelling — *if the plan allows* | 4.0 | 1,400 |
| Sparse-vegetation index (MSAVI2) | 2.0 | 700 |
| Fourth zone registration and history — *needs a paid plan* | 1.0 | 350 |
| **Subtotal** | **22.0** | **7,700** |
| *Optional:* real rainfall from a weather source | 6.0 | 2,100 |

Delivered plus remaining is 55 hours against the 54 quoted. The scope shifted:
the research, proposal and defect fixes were not separate quote lines, and soil
moisture now depends on the DynaCrop plan rather than on development time.

---

## 5. Implications for the full system

The Phase 3 estimates were not available when this was written, so adjustments
are given as additions.

1. **Normalisation engine.** Vendors deliver per-field statistics on irregular
   dates (every ~5 days, with three-week gaps in the rains), and on different
   scales — NDVI runs from −1 to 1, while SMI runs from 0 to 1 *relative to the
   local soil's limits* and is not a percentage. The engine needs a common time
   base, scale and unit information per product, a source on every reading, and
   duplicate-safe loading. **Suggest +8–10 h** for time alignment and scale
   handling, **less ~3 h** because the Phase 2 source-tracking design can be reused.

2. **Adding vendors 2 and 3.** DynaCrop-style APIs (queue-and-poll, rate limits,
   field registration) took roughly **10–14 h per vendor** including mapping and
   tests, plus scheduling. Note that DynaCrop alone may cover both vegetation and
   soil moisture, so "three independent vendors" may become **two vendors plus a
   weather source**. The pitch wording may need adjusting.

3. **Ingestion monitoring** should be its own line item. Observed: one history
   request was still processing after more than three minutes and succeeded on
   retry; only one request can process at a time; and trial expiry would silently
   stop new data. Needed: a run log, timeouts and retries, a warning when data is
   more than ~14 days old, and quota tracking via DynaCrop's account endpoint.
   **Suggest 6–8 h.**

4. **Alert system** (URD Farmer module) must compare each field against its own
   history and season. Fixed thresholds flag every zone on this parcel every dry
   season. **Suggest +4–6 h** over a fixed-threshold design.

5. **Running costs.** DynaCrop charges by registered area and limits fields per
   plan. Registering per zone multiplies the field count. The cost per farm is
   **unknown** until DynaCrop quotes; the proposal should carry a subscription
   line (passed through or with margin).

6. **Licence acknowledgement** is required on every published output that uses
   Sentinel data.

### Vendor 2 and 3 recommendations

- **Rainfall first.** It carries 55% of the drought score and is currently the
  whole of today's drought-risk figure. DynaCrop cannot supply it. Candidates to
  evaluate — **none tested in this phase**: CHIRPS (satellite-estimated rainfall,
  free, ~5 km grid), NASA POWER, Open-Meteo. A coarse grid is acceptable for
  rainfall, which varies over kilometres.
- **Soil moisture:** DynaCrop SMI (Sentinel-1), if a plan enables it — same
  vendor, suited to sparse vegetation, unaffected by cloud.
- **Higher-resolution vegetation:** PlanetScope via DynaCrop (data from 2020) is a
  separate paid product. Not tested.

---

Operational detail (refreshing data, safety rules, key handling):
[docs/dynacrop-handover.md](dynacrop-handover.md).
