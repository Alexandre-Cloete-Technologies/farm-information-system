import { SignOutButton } from "./SignOutButton";
import {
  COPERNICUS_ATTRIBUTION,
  describeProvenance,
  formatObservedOn,
} from "@/lib/data/provenance";
import type { FarmSnapshot, Profile } from "@/lib/data/types";
import { METRIC_LABELS, ROLE_LABELS } from "@/lib/data/types";

export function DashboardHeader({ profile, snapshot }: { profile: Profile; snapshot: FarmSnapshot }) {
  const asOf = new Date(snapshot.generatedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Farm Information System
          </p>
          <h1 className="text-lg font-semibold leading-tight">{snapshot.farm.name}</h1>
          <p className="text-xs text-muted">
            {snapshot.farm.region} · {snapshot.farm.area_ha} ha · data as of {asOf}
            {snapshot.source === "fallback" ? " (cached)" : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{profile.display_name}</p>
            <p className="text-xs text-muted">
              {ROLE_LABELS[profile.role]}
              {profile.organisation ? ` · ${profile.organisation}` : ""}
            </p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

/**
 * Where each figure on the page comes from.
 *
 * A lender has to be able to tell a measurement from a model at a glance, so
 * this states it per metric rather than hiding it in a footnote.
 */
export function VendorStrip({ snapshot }: { snapshot: FarmSnapshot }) {
  const provenance = describeProvenance(snapshot);

  return (
    <div className="border-b border-border bg-surface-muted">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 text-xs text-muted">
        <span className="font-medium uppercase tracking-wide">Data sources</span>

        {provenance.byMetric.map((m) => {
          const measured = m.origin === "satellite";
          return (
            <span key={m.metric} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${measured ? "bg-ok" : "bg-watch"}`}
                aria-hidden
              />
              <span className="font-medium text-foreground">{METRIC_LABELS[m.metric]}</span>
              {measured ? (
                <>
                  <span>· {m.instrument}</span>
                  <span>· observed {formatObservedOn(m.observedOn)}</span>
                  {m.simulatedZones.length > 0 ? (
                    <span className="text-watch">· {m.simulatedZones.length} zone simulated</span>
                  ) : null}
                </>
              ) : (
                <span className="text-watch">· simulated</span>
              )}
            </span>
          );
        })}

        <span className="ml-auto">
          {snapshot.source === "live" ? "Connected" : "Serving cached snapshot"}
        </span>
      </div>

      {provenance.anySatellite ? (
        <div className="mx-auto max-w-7xl px-4 pb-1.5 text-[10.5px] leading-snug text-muted">
          {COPERNICUS_ATTRIBUTION} Satellite imagery is not daily — figures show the latest available
          observation, not a live reading.
        </div>
      ) : null}
    </div>
  );
}
