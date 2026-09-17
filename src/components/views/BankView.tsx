import { FarmMap } from "@/components/FarmMap";
import { GenerateReportButton } from "@/components/GenerateReportButton";
import { RainfallChart } from "@/components/charts/RainfallChart";
import { Panel, Stat } from "@/components/ui/Panel";
import { REFERENCE, assessFarm, formatNad } from "@/lib/analytics/risk";
import type { FarmSnapshot } from "@/lib/data/types";
import { LAND_USE_LABELS } from "@/lib/data/types";

const BAND_TONE = {
  Low: "ok",
  Moderate: "watch",
  Elevated: "watch",
  High: "action",
} as const;

export function BankView({ snapshot }: { snapshot: FarmSnapshot }) {
  const a = assessFarm(snapshot);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Panel title="Risk & valuation" action={<GenerateReportButton />}>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Drought risk"
              value={String(a.droughtRisk)}
              unit="/100"
              hint={`${a.riskBand} risk band`}
              tone={BAND_TONE[a.riskBand]}
            />
            <Stat
              label="Productivity"
              value={String(a.productivityScore)}
              unit="/100"
              hint="Vegetation, rainfall, land condition"
              tone={a.productivityScore >= 60 ? "ok" : "watch"}
            />
          </div>

          <div className="mt-3 rounded-md border border-border p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Indicative land value
            </p>
            <p className="mt-1 text-3xl font-semibold leading-none">{formatNad(a.estimatedValueNad)}</p>
            <p className="mt-1.5 text-xs text-muted">
              {formatNad(a.valuePerHaNad)} per hectare × {snapshot.farm.area_ha} ha
            </p>
          </div>

          <p className="mt-3 text-xs text-muted">
            Satellite-derived indication only. Not a registered valuation, and no substitute for a
            physical inspection.
          </p>
        </Panel>

        <Panel title="Asset overview" subtitle="Land condition across the parcel">
          <FarmMap snapshot={snapshot} initialLayer="land_use" height={320} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="How the score is built" subtitle="Weighted components, higher means more risk">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Component</th>
                <th className="pb-2 text-right font-medium">Weight</th>
                <th className="pb-2 text-right font-medium">Deficit</th>
                <th className="pb-2 text-right font-medium">Contribution</th>
              </tr>
            </thead>
            <tbody>
              <ComponentRow
                label="Rainfall vs long-term mean"
                weight={0.55}
                deficit={a.components.rainfallDeficit}
                detail={`${a.seasonRainfallMm} mm recorded · ${REFERENCE.ANNUAL_RAINFALL_NORMAL_MM} mm normal`}
              />
              <ComponentRow
                label="Peak vegetation vigour"
                weight={0.3}
                deficit={a.components.vegetationDeficit}
                detail={`Peak NDVI ${a.peakNdvi} · reference ${REFERENCE.PEAK_NDVI_REFERENCE}`}
              />
              <ComponentRow
                label="Degraded land share"
                weight={0.15}
                deficit={a.components.degradationPenalty}
                detail={`${Math.round(a.degradedShare * 100)}% of the parcel`}
              />
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="pt-2">Drought risk</td>
                <td />
                <td />
                <td className="pt-2 text-right tabular-nums">{a.droughtRisk}</td>
              </tr>
            </tfoot>
          </table>
        </Panel>

        <Panel title="Rainfall record" subtitle="Monthly totals (mm) — the primary input to the risk score">
          <RainfallChart data={snapshot.monthlyRainfall} height={200} />
        </Panel>
      </div>

      <Panel title="Parcel composition">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2 font-medium">Zone</th>
              <th className="pb-2 font-medium">Classification</th>
              <th className="pb-2 text-right font-medium">Area</th>
              <th className="pb-2 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.zones.map((zone) => (
              <tr key={zone.id} className="border-b border-border last:border-0">
                <td className="py-2">{zone.name}</td>
                <td className="py-2 text-muted">{LAND_USE_LABELS[zone.land_use]}</td>
                <td className="py-2 text-right tabular-nums">{zone.area_ha} ha</td>
                <td className="py-2 text-right tabular-nums">
                  {Math.round((zone.area_ha / snapshot.farm.area_ha) * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function ComponentRow({
  label,
  weight,
  deficit,
  detail,
}: {
  label: string;
  weight: number;
  deficit: number;
  detail: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2">
        {label}
        <span className="block text-xs text-muted">{detail}</span>
      </td>
      <td className="py-2 text-right tabular-nums">{Math.round(weight * 100)}%</td>
      <td className="py-2 text-right tabular-nums">{deficit.toFixed(2)}</td>
      <td className="py-2 text-right tabular-nums">{Math.round(weight * deficit * 100)}</td>
    </tr>
  );
}
