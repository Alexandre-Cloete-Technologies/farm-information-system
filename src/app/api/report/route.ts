import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasSessionCookie, isAuthUnreachable } from "@/lib/supabase/offline";
import { getFarmSnapshot } from "@/lib/data/getFarmSnapshot";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Temporary diagnostic — see the note in GET(). */
async function runProbe(stage: string): Promise<Response> {
  const steps: string[] = [];
  try {
    steps.push("start");

    if (stage === "snapshot") {
      const s = await getFarmSnapshot();
      steps.push(`snapshot source=${s.source} zones=${s.zones.length} readings=${s.monthlyByZone.length}`);
    }

    if (stage === "assess") {
      const { assessFarm } = await import("@/lib/analytics/risk");
      const s = await getFarmSnapshot();
      const a = assessFarm(s);
      steps.push(`assessed risk=${a.droughtRisk} value=${a.estimatedValueNad}`);
    }

    if (stage === "diff") {
      const live = await getFarmSnapshot();
      const fallback = (await import("@/lib/data/fallback-snapshot.json")).default as never;
      const shape = (s: Record<string, unknown>) => {
        const farm = s.farm as Record<string, unknown>;
        const zones = s.zones as Record<string, unknown>[];
        const rain = s.monthlyRainfall as Record<string, unknown>[];
        return {
          area_ha: `${typeof farm.area_ha}:${JSON.stringify(farm.area_ha)}`,
          boundary: typeof farm.boundary_geojson,
          zoneAreas: zones.slice(0, 2).map((z) => `${typeof z.area_ha}:${JSON.stringify(z.area_ha)}`),
          rainMonths: rain.length,
          rainFirst: rain[0] ? JSON.stringify(rain[0]) : null,
        };
      };
      steps.push(`live=${JSON.stringify(shape(live as never))}`);
      steps.push(`fallback=${JSON.stringify(shape(fallback))}`);
    }

    if (stage === "doc-fallback") {
      const { valuationReportDocument } = await import("@/lib/report/ValuationReport");
      const fallback = (await import("@/lib/data/fallback-snapshot.json")).default;
      valuationReportDocument(fallback as never);
      steps.push("document element built from bundled snapshot");
    }

    if (stage === "doc-live") {
      const { valuationReportDocument } = await import("@/lib/report/ValuationReport");
      const s = await getFarmSnapshot();
      valuationReportDocument(s);
      steps.push(`document element built from ${s.source} snapshot`);
    }

    if (stage === "render-fallback") {
      const [{ renderToBuffer }, { valuationReportDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/report/ValuationReport"),
      ]);
      const fallback = (await import("@/lib/data/fallback-snapshot.json")).default;
      const buffer = await renderToBuffer(valuationReportDocument(fallback as never));
      steps.push(`rendered ${buffer.length} bytes from bundled snapshot`);
    }

    return NextResponse.json({ ok: true, stage, steps });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage,
        steps,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6) : undefined,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  // Temporary: ?probe=N walks the PDF pipeline one stage at a time so a crash
  // that kills the whole function (rather than throwing catchably) can be
  // pinned to a specific step. Netlify's function logs aren't readable from
  // this account, so the response is the only channel. Remove once the report
  // route is healthy.
  const probe = new URL(request.url).searchParams.get("probe");
  if (probe) return runProbe(probe);

  const supabase = await createClient();

  let user = null;
  let unreachable = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    unreachable = isAuthUnreachable(error);
  } catch {
    unreachable = true;
  }

  // Same degraded rule as the dashboard: if Supabase is unreachable but this
  // browser carries a session, render the report from the bundled snapshot
  // rather than failing on the one click a bank persona is watching.
  if (!user && !(unreachable && hasSessionCookie((await cookies()).getAll()))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    // Both imports are deferred to here on purpose. react-pdf pulls in a deep
    // native/WASM dependency tree, and if any of it fails to resolve in the
    // deployed bundle a top-level import takes the whole function down at init
    // — the client gets a bare 502 that this handler never runs to catch.
    // ValuationReport counts too: it imports react-pdf itself, so importing it
    // statically would drag the same tree in through the back door.
    const [{ renderToBuffer }, { valuationReportDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/report/ValuationReport"),
    ]);

    const snapshot = await getFarmSnapshot();
    const buffer = await renderToBuffer(valuationReportDocument(snapshot));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="farm-valuation-risk-report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/report] render failed", error);

    // Netlify's function logs need a paid plan / matching account, so set
    // FIS_DEBUG_ERRORS=1 on the deploy to read the cause from the response
    // instead. Off by default: a product that gets resold shouldn't leak
    // internals to whoever clicks the button.
    const detail =
      process.env.FIS_DEBUG_ERRORS === "1"
        ? { detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
        : {};

    return NextResponse.json(
      { error: "Could not generate the report", ...detail },
      { status: 500 },
    );
  }
}
