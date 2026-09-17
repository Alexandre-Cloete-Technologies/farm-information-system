import { renderToBuffer } from "@react-pdf/renderer";
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
