# Integrated Farm Information System — MVP

A web-only prototype of the FIS: satellite-derived soil moisture, vegetation
index and rainfall for one Namibian farm, presented through three role-based
dashboards. Built to demo to investors, scoped to Section 6 of the URD.

Satellite readings are **simulated**. There is no vendor integration yet — the
`mock_readings` table stands in for the ingestion pipeline, with each metric
labelled by a placeholder vendor so the "we aggregate three vendors" story stays
visible on screen.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router), Tailwind 4 | Existing familiarity; one deployable |
| Backend | Supabase (Postgres, Auth) | Whole platform is open-source and self-hostable later |
| Maps | MapLibre GL + react-map-gl | No API key, no vendor billing |
| Charts | Recharts | |
| Reports | @react-pdf/renderer, server-side | |
| Hosting | Netlify | |

Nothing here is locked to a hosted vendor: the database is plain Postgres and
the map has no key, so a future owner can run the whole thing themselves.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev
```

Then open http://localhost:3000 and sign in with one of the demo accounts on the
login page (they are listed there, one click each).

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Unit tests (risk formula, PDF generation) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed:snapshot` | Regenerate the offline fallback snapshot from Supabase |

`predev` and `prebuild` copy MapLibre's web worker into `public/maplibre/` — see
`scripts/copy-maplibre-worker.mjs` for why that is necessary.

**`@rolldown/binding-win32-x64-msvc` must stay in `optionalDependencies`.**
Vitest 5 pulls its native binding through npm's optional-dependency mechanism,
which [npm/cli#4828](https://github.com/npm/cli/issues/4828) sometimes skips on
Windows — hence the explicit entry. As a regular `devDependency` it is a
Windows-only binary that Linux cannot satisfy, and Netlify's build dies at
`npm install` with `EBADPLATFORM` before it compiles anything. Listed as
optional, npm installs it on Windows and skips it elsewhere. Check any change
here with `npm install --dry-run --os=linux --cpu=x64`.

**The report route needs `outputFileTracingIncludes`.** react-pdf loads parts
of its dependency tree by path at runtime, and Next's file tracing misses two
of them: `yoga-layout`'s entry point, and pdfkit's `.cjs` standard-font metrics
(it traces only the `.mjs` variants). Both are invisible locally and only bite
in the deployed function, where the missing module takes the whole thing down
and Netlify returns a bare 502. `next.config.ts` forces both in. If you add
fonts or swap the PDF library, re-check that the deployed route still returns a
PDF — a green build proves nothing here.

To debug that class of failure, set `FIS_DEBUG_ERRORS=1` on the deploy and the
route returns the underlying error in its 500 body.

**`build` pins Webpack on purpose.** Next 16 builds with Turbopack by default,
but `@netlify/plugin-nextjs` (5.16.0, the current release) cannot bundle a
Turbopack-built middleware into a Netlify edge function — it fails on chunk
names like `[turbopack]_runtime.js`. Dropping `--webpack` will break the deploy,
not the local build, so it looks harmless. Revisit once the plugin supports
Turbopack.

## Demo accounts

All three share the password `FisDemo2026!`. They exist only in the demo
project; the login page lists them so whoever is presenting can switch personas
in one click.

| Email | Role | Sees |
|---|---|---|
| `farmer@example.com` | Farmer | Field-health map, rainfall, grazing capacity, zone status |
| `agronomist@example.com` | Agronomist | Zone trend comparison, soil retention, prescriptions |
| `bank@example.com` | Bank / Valuation Officer | Risk score, indicative valuation, PDF report |

Switching roles means signing out and signing in as another account — there is
no in-session toggle.

## How the data is shaped

One farm, a real 25.2 ha smallholding at Brakwater about 20 km north of
Windhoek. The boundary polygon is an illustrative rectangle sized to the listed
hectares, not surveyed parcel lines. It is split into four management zones
(cropland, two grazing camps, a degraded riverbed strip) so the map overlays
have something to vary across.

Twelve months of readings are seeded with Khomas Region seasonality — wet
November to April, dry May to October — and rainfall normalised to the regional
monthly means at 85% of normal, so the drought-risk score has a real signal to
read rather than noise.

| Table / view | Holds |
|---|---|
| `farms` | The demo parcel and its boundary GeoJSON |
| `farm_zones` | Management zones inside the boundary |
| `mock_readings` | The time series, tagged by vendor and metric |
| `profiles` | `role` per auth user — drives which dashboard renders |
| `zone_latest_metrics`, `zone_monthly_metrics`, `farm_monthly_rainfall`, `vendor_feed_status` | Aggregates the dashboards read, so pages fetch tens of rows instead of thousands |

A `pg_cron` job (`fis-live-feed-tick`) nudges each metric every two minutes so a
dashboard left open during the pitch visibly ticks. It is decorative — turn it
off with `select cron.unschedule('fis-live-feed-tick');` and everything still
works off the seeded history.

## Architecture notes

**One read path.** Every screen and the report API go through
`getFarmSnapshot()` in `src/lib/data/getFarmSnapshot.ts`. Swapping the mocked
table for real vendor ingestion is a change inside that function — no UI touches
Supabase directly.

**It will not break mid-pitch.** If the live read fails for any reason, that
function silently falls back to `src/lib/data/fallback-snapshot.json`, a copy of
the data baked into the build. The header says "cached" when that happens
instead of showing an error. Regenerate the snapshot with `npm run seed:snapshot`
after changing the seed data.

Auth sits in front of that, so it gets the same treatment
(`src/lib/supabase/offline.ts`). If `auth.getUser()` fails because Supabase is
unreachable — as opposed to the token being rejected — and the browser is
carrying a session, the dashboard renders the cached demo instead of redirecting
to a login page that also can't reach Supabase. The role comes from a
`fis-last-role` cookie the login page writes. The report route follows the same
rule, so **Generate report** still works offline. None of this grants access: a
session cookie must already be present, and it only ever reaches the same public
demo data.

**No middleware.** `@netlify/plugin-nextjs` 5.16.0 cannot bundle a Next 16
middleware into a Netlify edge function, and the build fails outright when one
exists. So each route gates itself instead: `/dashboard` and `/api/report` check
the session directly, `/login` bounces anyone already signed in, and
`<SessionKeeper>` handles the token refresh middleware used to do. If you add a
`middleware.ts` or `proxy.ts` back, the deploy will break — put the check in the
route.

**The numbers are defensible.** `src/lib/analytics/risk.ts` holds the risk and
valuation formula, with every assumption a valuer would argue about named as a
constant in one `REFERENCE` block. It reads season-scale inputs (12-month
rainfall, peak growing-season NDVI) rather than today's values, so running the
demo in the dry season does not make the farm look like a disaster. It is unit
tested.

**Row Level Security is on** for every table. Real multi-tenant permissioning is
deferred, but the publishable key can read nothing without a signed-in session.

## Deploying

Netlify, with `@netlify/plugin-nextjs`. Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in the site's environment variables. Both are
safe to expose — RLS bounds what they can do.

## Out of scope for this phase

Real vendor APIs and ingestion scheduling, the URD's alert system, multi-farm
support, a native mobile app, multi-tenant permissioning, and production
security hardening. See `docs/pre-pitch-checklist.md` before demoing.
