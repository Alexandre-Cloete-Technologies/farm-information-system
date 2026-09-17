import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasSessionCookie, isAuthUnreachable } from "@/lib/supabase/offline";
import { valuationReportDocument } from "@/lib/report/ValuationReport";
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
    // Imported here rather than at module scope on purpose. react-pdf pulls in
    // a deep native/WASM dependency tree, and if any of it fails to resolve in
    // the deployed bundle a top-level import takes the whole function down at
    // init — the client sees a bare 502 that this handler never gets to catch.
    // Inside the try, the same failure becomes the retryable error the Bank
    // view already knows how to show.
    const { renderToBuffer } = await import("@react-pdf/renderer");

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
    return NextResponse.json({ error: "Could not generate the report" }, { status: 500 });
  }
}
