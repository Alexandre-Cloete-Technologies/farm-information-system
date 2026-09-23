import { FarmMap } from "@/components/FarmMap";
import { ZoneTrendChart } from "@/components/charts/ZoneTrendChart";
import { EmptyState, OriginBadge, Panel, SeverityDot } from "@/components/ui/Panel";
import { isMeasured } from "@/lib/data/provenance";
import { buildPrescriptions, zoneConditions } from "@/lib/analytics/agronomy";
import type { FarmSnapshot } from "@/lib/data/types";
import { LAND_USE_LABELS } from "@/lib/data/types";

export function AgronomistView({ snapshot }: { snapshot: FarmSnapshot }) {
  const prescriptions = buildPrescriptions(snapshot);
  const conditions = zoneConditions(snapshot);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="Zone comparison" subtitle="Vegetation index (NDVI, 0–1) by management zone">
          <ZoneTrendChart snapshot={snapshot} metric="ndvi" height={260} />
        </Panel>

        <Panel title="Field map" subtitle="Switch layers to compare moisture and cover">
          <FarmMap snapshot={snapshot} initialLayer="ndvi" height={300} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Soil moisture retention" subtitle="Volumetric soil moisture (%) by zone">
          <ZoneTrendChart snapshot={snapshot} metric="soil_moisture" height={240} />
        </Panel>

        <Panel title="Zone characteristics">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Zone</th>
                  <th className="pb-2 font-medium">Use</th>
                  <th className="pb-2 text-right font-medium">Area</th>
                  <th className="pb-2 text-right font-medium">Moisture</th>
                  <th className="pb-2 text-right font-medium">NDVI</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((condition) => (
                  <tr key={condition.zone.id} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <SeverityDot severity={condition.severity} />
                        {condition.zone.name}
                        <OriginBadge measured={isMeasured(snapshot, condition.zone.id, "ndvi")} />
                      </span>
                    </td>
                    <td className="py-2 text-muted">{LAND_USE_LABELS[condition.zone.land_use]}</td>
                    <td className="py-2 text-right tabular-nums">{condition.zone.area_ha} ha</td>
                    <td className="py-2 text-right tabular-nums">
                      {condition.soilMoisture?.toFixed(1) ?? "—"}%
                    </td>
                    <td className="py-2 text-right tabular-nums">{condition.ndvi?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        title="Prescriptions"
        subtitle="Generated from the latest readings — review before issuing to the farmer"
      >
        {prescriptions.length === 0 ? (
          <EmptyState message="No readings available to base recommendations on." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {prescriptions.map((prescription) => (
              <li
                key={prescription.zoneName}
                className="rounded-md border border-border bg-surface-muted p-3"
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <SeverityDot severity={prescription.severity} />
                  {prescription.zoneName}
                </p>
                <p className="mt-1.5 text-sm">{prescription.recommendation}</p>
                <p className="mt-2 text-xs text-muted">Based on {prescription.basis}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
