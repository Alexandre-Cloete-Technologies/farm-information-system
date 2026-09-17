"use client";

import type { ReactNode } from "react";
import { CHART_INK } from "./theme";

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function TooltipCard({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: ReactNode }) {
  return (
    <div
      className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md"
      style={{ color: CHART_INK.primary }}
    >
      <p className="font-semibold">{title}</p>
      <dl className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-5">
            <dt className="flex items-center gap-1.5" style={{ color: CHART_INK.secondary }}>
              {row.color ? (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: row.color }}
                  aria-hidden
                />
              ) : null}
              {row.label}
            </dt>
            <dd className="font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer ? (
        <p className="mt-1.5 text-[11px]" style={{ color: CHART_INK.muted }}>
          {footer}
        </p>
      ) : null}
    </div>
  );
}
