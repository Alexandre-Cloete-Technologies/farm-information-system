/**
 * Chart chrome and series colours.
 *
 * The four series slots are the first four of the validated categorical order.
 * Checked with the palette validator against this app's white chart surface:
 * lightness band, chroma floor, CVD separation (worst adjacent dE 9.1) and the
 * normal-vision floor all pass. Aqua and yellow fall below 3:1 contrast on
 * white, so every multi-series chart here also carries direct end-of-line
 * labels — identity never rests on colour alone.
 *
 * Slots are assigned to zones by fixed index, never cycled, so a zone keeps its
 * colour no matter which chart or filter it appears in.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;

export const CHART_INK = {
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  secondary: "#52514e",
  primary: "#0b0b0b",
  surface: "#ffffff",
} as const;

export const AXIS_TICK = { fill: CHART_INK.muted, fontSize: 11 } as const;

/** Stable colour for a zone, by its position in the farm's zone list. */
export function zoneColor(index: number): string {
  return SERIES[index % SERIES.length];
}

export function shortMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short" });
}

/**
 * Axis tick label. Carries the year because a rolling 12-month window spans two
 * of them — "Sep" alone would appear twice and read as a duplicate.
 */
export function shortMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export function longMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
