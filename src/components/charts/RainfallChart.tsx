"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyRainfall } from "@/lib/data/types";
import { AXIS_TICK, CHART_INK, SERIES, longMonth, shortMonthYear } from "./theme";
import { TooltipCard } from "./ChartTooltip";

/** Khomas Region long-term mean rainfall by calendar month, mm. */
const MONTHLY_NORMAL_MM: Record<number, number> = {
  0: 78, 1: 80, 2: 79, 3: 38, 4: 6, 5: 1,
  6: 1, 7: 1, 8: 3, 9: 12, 10: 28, 11: 45,
};

export function RainfallChart({ data, height = 220 }: { data: MonthlyRainfall[]; height?: number }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No rainfall recorded for this period.</p>;
  }

  const rows = data.map((row) => ({
    month: row.month,
    actual: row.total_mm,
    normal: MONTHLY_NORMAL_MM[new Date(row.month).getMonth()] ?? 0,
    rainDays: row.rain_days,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap="22%">
        <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={shortMonthYear}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: CHART_INK.axis }}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as (typeof rows)[number];
            return (
              <TooltipCard
                title={longMonth(row.month)}
                rows={[
                  { label: "Recorded", value: `${row.actual.toFixed(1)} mm`, color: SERIES[0] },
                  { label: "Long-term mean", value: `${row.normal} mm`, color: CHART_INK.muted },
                ]}
                footer={`${row.rainDays} day${row.rainDays === 1 ? "" : "s"} with measurable rain`}
              />
            );
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={26}
          iconType="plainline"
          wrapperStyle={{ fontSize: 11, color: CHART_INK.secondary }}
        />
        <Bar dataKey="actual" name="Recorded" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Line
          dataKey="normal"
          name="Long-term mean"
          type="monotone"
          stroke={CHART_INK.muted}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
