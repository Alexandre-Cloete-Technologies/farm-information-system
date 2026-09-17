import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasSessionCookie, isAuthUnreachable } from "@/lib/supabase/offline";
import { getFarmSnapshot } from "@/lib/data/getFarmSnapshot";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
    // dependency tree that is loaded by path at runtime, and anything missing
    // from the deployed bundle takes the whole function down at init if it is
    // imported at module scope — the client gets a bare 502 this handler never
    // runs to catch. ValuationReport counts too: it imports react-pdf itself,
    // so importing it statically would drag the same tree in through the back
    // door. Deferred, the same failure becomes the retryable error the Bank
    // view already renders. (See next.config.ts for the tracing this needs.)
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

    // Netlify's function logs need a matching account/plan, so set
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
