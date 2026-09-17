"use client";

import { useState } from "react";

type State = "idle" | "working" | "failed";

/**
 * Downloads the valuation report.
 *
 * A failure here happens in front of a bank persona, so it never dies
 * silently — the button turns into a visible retry.
 */
export function GenerateReportButton() {
  const [state, setState] = useState<State>("idle");

  async function generate() {
    setState("working");
    try {
      const response = await fetch("/api/report", { method: "GET" });
      if (!response.ok) throw new Error(`Report API responded ${response.status}`);

      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Report came back empty");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "farm-valuation-risk-report.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setState("idle");
    } catch (error) {
      console.error("[report] generation failed", error);
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={generate}
        disabled={state === "working"}
        className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-70 ${
          state === "failed" ? "bg-action hover:bg-action/90" : "bg-brand hover:bg-brand-strong"
        }`}
      >
        {state === "working" ? "Generating…" : state === "failed" ? "Retry report" : "Generate report"}
      </button>
      {state === "failed" ? (
        <p role="alert" className="text-xs text-action">
          Report generation failed. Try again.
        </p>
      ) : null}
    </div>
  );
}
