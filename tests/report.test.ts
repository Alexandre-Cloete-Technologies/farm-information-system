import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { valuationReportDocument } from "@/lib/report/ValuationReport";
import fallbackSnapshot from "@/lib/data/fallback-snapshot.json";
import type { FarmSnapshot } from "@/lib/data/types";
import { makeSnapshot } from "./fixtures";

const render = (snapshot: FarmSnapshot) => renderToBuffer(valuationReportDocument(snapshot));

describe("valuation report", () => {
  it("renders a valid, non-empty PDF from the demo snapshot", async () => {
    const buffer = await render(fallbackSnapshot as unknown as FarmSnapshot);

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(5_000);
    expect(buffer.subarray(-1024).toString("latin1")).toContain("%%EOF");
  }, 30_000);

  it("renders even when a farm has no readings to report on", async () => {
    const bare = makeSnapshot({ monthlyRainfall: [], monthlyByZone: [], latestByZone: [] });
    const buffer = await render(bare);

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1_000);
  }, 30_000);
});
