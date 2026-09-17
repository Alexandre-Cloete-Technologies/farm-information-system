import { SignOutButton } from "./SignOutButton";
import type { FarmSnapshot, Profile } from "@/lib/data/types";
import { ROLE_LABELS } from "@/lib/data/types";

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

export function VendorStrip({ snapshot }: { snapshot: FarmSnapshot }) {
  const metricNames: Record<string, string> = {
    soil_moisture: "Soil moisture",
    ndvi: "Vegetation index",
    rainfall: "Rainfall",
  };

  return (
    <div className="border-b border-border bg-surface-muted">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-xs text-muted">
        <span className="font-medium uppercase tracking-wide">Vendor feeds</span>
        {snapshot.vendors.map((vendor) => (
          <span key={`${vendor.vendor_label}-${vendor.metric_type}`} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                snapshot.source === "live" ? "bg-ok" : "bg-watch"
              }`}
              aria-hidden
            />
            {vendor.vendor_label} · {metricNames[vendor.metric_type] ?? vendor.metric_type} ·{" "}
            {vendor.reading_count.toLocaleString("en-GB")} readings
          </span>
        ))}
        <span className="ml-auto">
          {snapshot.source === "live" ? "Connected" : "Serving cached snapshot"}
        </span>
      </div>
    </div>
  );
}
