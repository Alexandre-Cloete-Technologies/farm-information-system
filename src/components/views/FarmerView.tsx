import { FarmMap } from "@/components/FarmMap";
import { RainfallChart } from "@/components/charts/RainfallChart";
import { EmptyState, Panel, SeverityDot, Stat } from "@/components/ui/Panel";
import { daysSinceRain, zoneConditions } from "@/lib/analytics/agronomy";
import { assessFarm } from "@/lib/analytics/risk";
import type { FarmSnapshot } from "@/lib/data/types";
import { LAND_USE_LABELS } from "@/lib/data/types";

export function FarmerView({ snapshot }: { snapshot: FarmSnapshot }) {
  const conditions = zoneConditions(snapshot);
  const assessment = assessFarm(snapshot);
  const dryDays = daysSinceRain(snapshot);

  const wettest = [...conditions].sort((a, b) => (b.soilMoisture ?? 0) - (a.soilMoisture ?? 0))[0];
  const driest = [...conditions].sort((a, b) => (a.soilMoisture ?? 99) - (b.soilMoisture ?? 99))[0];
  const seasonToDate = snapshot.monthlyRainfall.slice(-3).reduce((sum, m) => sum + m.total_mm, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Panel
          title="Field health"
          subtitle="Latest satellite pass across each management zone"
        >
          <FarmMap snapshot={snapshot} initialLayer="soil_moisture" height={440} />
        </Panel>

        <Panel title="Rainfall" subtitle="Monthly totals (mm) against the Khomas long-term mean">
          <RainfallChart data={snapshot.monthlyRainfall} />
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Right now">
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Season rainfall"
              value={assessment.seasonRainfallMm.toFixed(0)}
              unit="mm"
              hint={`${Math.round(assessment.rainfallIndex * 100)}% of normal`}
              tone={assessment.rainfallIndex < 0.8 ? "watch" : "ok"}
            />
            <Stat
              label="Last 3 months"
              value={seasonToDate.toFixed(0)}
              unit="mm"
              hint={dryDays === null ? "No rain on record" : `${dryDays} days since rain`}
              tone={seasonToDate < 5 ? "watch" : "neutral"}
            />
            <Stat
              label="Wettest zone"
              value={wettest?.soilMoisture?.toFixed(1) ?? "—"}
              unit="%"
              hint={wettest?.zone.name}
            />
            <Stat
              label="Driest zone"
              value={driest?.soilMoisture?.toFixed(1) ?? "—"}
              unit="%"
              hint={driest?.zone.name}
              tone={driest && (driest.soilMoisture ?? 99) < 8 ? "action" : "neutral"}
            />
          </div>
        </Panel>

        <Panel title="Grazing management" subtitle="Sustainable stocking at current cover">
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Capacity"
              value={assessment.grazingCapacityLsu.toFixed(1)}
              unit="LSU"
              hint={`${assessment.grazingHa} ha of grazing`}
            />
            <Stat
              label="Stocking rate"
              value={assessment.haPerLsu.toFixed(1)}
              unit="ha/LSU"
              hint={`Normal year: 15 ha/LSU`}
              tone={assessment.haPerLsu > 18 ? "watch" : "ok"}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Large stock units the grazing camps can carry without degrading cover, derived from peak
            NDVI and season rainfall.
          </p>
        </Panel>

        <Panel title="Zone status" subtitle={`${snapshot.zones.length} management zones`}>
          {conditions.length === 0 ? (
            <EmptyState message="No zones defined for this farm." />
          ) : (
            <ul className="space-y-2">
              {conditions.map((condition) => (
                <li
                  key={condition.zone.id}
                  className="flex items-start justify-between gap-3 rounded-md bg-surface-muted px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <SeverityDot severity={condition.severity} />
                      {condition.zone.name}
                    </p>
                    <p className="text-xs text-muted">
                      {LAND_USE_LABELS[condition.zone.land_use]} · {condition.zone.area_ha} ha ·{" "}
                      {condition.headline}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums">
                    <p>{condition.soilMoisture?.toFixed(1) ?? "—"}%</p>
                    <p className="text-muted">NDVI {condition.ndvi?.toFixed(2) ?? "—"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
