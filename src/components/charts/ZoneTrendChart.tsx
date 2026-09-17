"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  useXAxisScale,
  useYAxisScale,
} from "recharts";
import type { FarmSnapshot, MetricType } from "@/lib/data/types";
import { AXIS_TICK, CHART_INK, longMonth, shortMonthYear, zoneColor } from "./theme";
import { TooltipCard } from "./ChartTooltip";

const METRIC_CONFIG: Record<
  Exclude<MetricType, "rainfall">,
  { unit: string; digits: number; domain: [number, number | "auto"] }
> = {
  soil_moisture: { unit: "%", digits: 1, domain: [0, "auto"] },
  ndvi: { unit: "", digits: 2, domain: [0, 0.8] },
};

interface SeriesPoint {
  name: string;
  color: string;
  value: number;
}

/**
 * Writes each series' name beside its final point, pushing labels apart where
 * lines converge.
 *
 * Two of the four palette slots fall below 3:1 contrast on white, so these
 * labels are a requirement rather than decoration — the line's colour alone
 * must not have to carry its identity. Rendered inside the chart so Recharts'
 * scale hooks resolve against the real plot area.
 */
function EndLabels({ series, atLabel }: { series: SeriesPoint[]; atLabel: string }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  if (!xScale || !yScale) return null;

  const x = xScale(atLabel, { position: "middle" });
  if (x === undefined) return null;

  const placed = series
    .map((s) => ({ ...s, y: yScale(s.value) }))
    .filter((s): s is SeriesPoint & { y: number } => s.y !== undefined)
    .sort((a, b) => a.y - b.y);

  const MIN_GAP = 12;
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].y - placed[i - 1].y < MIN_GAP) {
      placed[i].y = placed[i - 1].y + MIN_GAP;
    }
  }

  return (
    <g>
      {placed.map((p) => (
        <text key={p.name} x={x + 8} y={p.y} dy={3.5} fontSize={10} fill={CHART_INK.secondary}>
          {p.name}
        </text>
      ))}
    </g>
  );
}

export function ZoneTrendChart({
  snapshot,
  metric,
  height = 240,
}: {
  snapshot: FarmSnapshot;
  metric: Exclude<MetricType, "rainfall">;
  height?: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const config = METRIC_CONFIG[metric];

  const { rows, zones } = useMemo(() => {
    const zoneList = snapshot.zones.map((zone, index) => ({
      id: zone.id,
      name: zone.name,
      color: zoneColor(index),
    }));

    const byMonth = new Map<string, Record<string, number | string>>();
    for (const entry of snapshot.monthlyByZone) {
      if (entry.metric_type !== metric) continue;
      const zone = zoneList.find((z) => z.id === entry.zone_id);
      if (!zone) continue;
      const row = byMonth.get(entry.month) ?? { month: entry.month };
      row[zone.name] = entry.avg_value;
      byMonth.set(entry.month, row);
    }

    return {
      rows: [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month))),
      zones: zoneList,
    };
  }, [snapshot, metric]);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No readings for this period.</p>;
  }

  const lastRow = rows[rows.length - 1];
  const lastMonth = String(lastRow.month);
  const endSeries: SeriesPoint[] = zones
    .filter((zone) => typeof lastRow[zone.name] === "number")
    .map((zone) => ({ name: zone.name, color: zone.color, value: lastRow[zone.name] as number }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 100, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={shortMonthYear}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART_INK.axis }}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={config.domain}
          />
          <Tooltip
            cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TooltipCard
                  title={longMonth(String(label))}
                  rows={payload.map((item) => ({
                    label: String(item.name),
                    value: `${Number(item.value).toFixed(config.digits)}${config.unit}`,
                    color: item.color,
                  }))}
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
          {zones.map((zone) => (
            <Line
              key={zone.id}
              dataKey={zone.name}
              name={zone.name}
              type="monotone"
              stroke={zone.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_INK.surface }}
            />
          ))}
          <EndLabels series={endSeries} atLabel={lastMonth} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-muted">
          Monthly average per zone, to {longMonth(lastMonth)}.
        </p>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-[11px] font-medium text-brand underline underline-offset-2 hover:text-brand-strong"
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      {showTable ? (
        <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-muted text-left">
              <tr>
                <th className="px-2 py-1.5 font-medium">Month</th>
                {zones.map((zone) => (
                  <th key={zone.id} className="px-2 py-1.5 text-right font-medium">
                    {zone.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.month)} className="border-t border-border">
                  <td className="px-2 py-1">{shortMonthYear(String(row.month))}</td>
                  {zones.map((zone) => (
                    <td key={zone.id} className="px-2 py-1 text-right tabular-nums">
                      {typeof row[zone.name] === "number"
                        ? (row[zone.name] as number).toFixed(config.digits) + config.unit
                        : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
