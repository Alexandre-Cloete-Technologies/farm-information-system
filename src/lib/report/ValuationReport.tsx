import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { REFERENCE, assessFarm, formatNad } from "@/lib/analytics/risk";
import {
  COPERNICUS_ATTRIBUTION,
  describeProvenance,
  formatObservedOn,
} from "@/lib/data/provenance";
import type { FarmSnapshot } from "@/lib/data/types";
import { LAND_USE_LABELS, METRIC_LABELS } from "@/lib/data/types";

const INK = {
  heading: "#5d3a12",
  body: "#1f1a14",
  muted: "#6b6255",
  rule: "#ddd6c9",
  bar: "#2a78d6",
  barTrack: "#efece4",
};

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 9.5, color: INK.body },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.4, color: INK.heading, textTransform: "uppercase" },
  title: { fontSize: 18, marginTop: 6, color: INK.body },
  subtitle: { fontSize: 9.5, color: INK.muted, marginTop: 3 },
  rule: { borderBottomWidth: 1, borderBottomColor: INK.rule, marginVertical: 14 },
  sectionTitle: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: INK.heading,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  section: { marginBottom: 16 },
  statRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: "#f6f4ef", borderRadius: 4, padding: 9 },
  statLabel: { fontSize: 7, color: INK.muted, textTransform: "uppercase", letterSpacing: 0.7 },
  statValue: { fontSize: 15, marginTop: 4 },
  statHint: { fontSize: 7.5, color: INK.muted, marginTop: 3 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.7, borderBottomColor: INK.rule },
  headRow: { flexDirection: "row", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: INK.rule },
  th: { fontSize: 7, color: INK.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  cell: { fontSize: 9 },
  cellMuted: { fontSize: 9, color: INK.muted },
  barTrack: { height: 6, backgroundColor: INK.barTrack, borderRadius: 3 },
  barFill: { height: 6, backgroundColor: INK.bar, borderRadius: 3 },
  note: { fontSize: 7.5, color: INK.muted, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    fontSize: 7,
    color: INK.muted,
    borderTopWidth: 0.7,
    borderTopColor: INK.rule,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/**
 * Builds the report document.
 *
 * A plain builder rather than a component, so the returned element is typed as
 * react-pdf's `Document` — which is what `renderToBuffer` expects.
 */
export function valuationReportDocument(snapshot: FarmSnapshot) {
  const a = assessFarm(snapshot);
  const provenance = describeProvenance(snapshot);
  const generated = new Date();
  const maxRain = Math.max(...snapshot.monthlyRainfall.map((m) => m.total_mm), 1);

  return (
    <Document
      title={`Farm Property Valuation & Risk Report — ${snapshot.farm.name}`}
      author="Farm Information System"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Farm Information System</Text>
        <Text style={styles.title}>Farm Property Valuation &amp; Risk Report</Text>
        <Text style={styles.subtitle}>
          {snapshot.farm.name} · {snapshot.farm.region} · {snapshot.farm.area_ha} ha
        </Text>
        <Text style={styles.subtitle}>
          Prepared {generated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          {provenance.latestObservedOn
            ? ` · Satellite data to ${formatObservedOn(provenance.latestObservedOn)}`
            : " · Modelled data"}
        </Text>

        <View style={styles.rule} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Indicative value</Text>
              <Text style={styles.statValue}>{formatNad(a.estimatedValueNad)}</Text>
              <Text style={styles.statHint}>{formatNad(a.valuePerHaNad)} per hectare</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Drought risk</Text>
              <Text style={styles.statValue}>{a.droughtRisk} / 100</Text>
              <Text style={styles.statHint}>{a.riskBand} risk band</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Productivity</Text>
              <Text style={styles.statValue}>{a.productivityScore} / 100</Text>
              <Text style={styles.statHint}>Peak NDVI {a.peakNdvi}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Grazing capacity</Text>
              {/* Single interpolated strings: react-pdf drops the leading space
                  when a literal follows an expression as a sibling child. */}
              <Text style={styles.statValue}>{`${a.grazingCapacityLsu} LSU`}</Text>
              <Text style={styles.statHint}>{`${a.haPerLsu} ha per LSU`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk composition</Text>
          <View style={styles.headRow}>
            <Text style={[styles.th, { flex: 3 }]}>Component</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Weight</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Deficit</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Points</Text>
          </View>
          <RiskRow
            label="Rainfall vs long-term mean"
            detail={`${a.seasonRainfallMm} mm over 12 months against a ${REFERENCE.ANNUAL_RAINFALL_NORMAL_MM} mm norm`}
            weight={0.55}
            deficit={a.components.rainfallDeficit}
          />
          <RiskRow
            label="Peak vegetation vigour"
            detail={`Area-weighted peak NDVI ${a.peakNdvi} against a ${REFERENCE.PEAK_NDVI_REFERENCE} reference`}
            weight={0.3}
            deficit={a.components.vegetationDeficit}
          />
          <RiskRow
            label="Degraded land share"
            detail={`${Math.round(a.degradedShare * 100)}% of the parcel classified as degraded`}
            weight={0.15}
            deficit={a.components.degradationPenalty}
          />
        </View>

        <View style={styles.section}>
          {/* Helvetica's WinAnsi subset has no em dash, so it renders as a gap. */}
          <Text style={styles.sectionTitle}>Rainfall record · last 12 months</Text>
          {snapshot.monthlyRainfall.map((month) => (
            <View key={month.month} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
              <Text style={[styles.cellMuted, { width: 54 }]}>
                {new Date(month.month).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
              </Text>
              <View style={[styles.barTrack, { flex: 1 }]}>
                <View style={[styles.barFill, { width: `${(month.total_mm / maxRain) * 100}%` }]} />
              </View>
              <Text style={[styles.cell, { width: 52, textAlign: "right" }]}>
                {month.total_mm.toFixed(1)} mm
              </Text>
              <Text style={[styles.cellMuted, { width: 54, textAlign: "right" }]}>
                {month.rain_days} days
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parcel composition</Text>
          <View style={styles.headRow}>
            <Text style={[styles.th, { flex: 3 }]}>Zone</Text>
            <Text style={[styles.th, { flex: 2 }]}>Classification</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Area</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Share</Text>
          </View>
          {snapshot.zones.map((zone) => (
            <View key={zone.id} style={styles.row}>
              <Text style={[styles.cell, { flex: 3 }]}>{zone.name}</Text>
              <Text style={[styles.cellMuted, { flex: 2 }]}>{LAND_USE_LABELS[zone.land_use]}</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{zone.area_ha} ha</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>
                {Math.round((zone.area_ha / snapshot.farm.area_ha) * 100)}%
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data provenance</Text>
          <View style={styles.headRow}>
            <Text style={[styles.th, { flex: 2 }]}>Measurement</Text>
            <Text style={[styles.th, { flex: 1 }]}>Source</Text>
            <Text style={[styles.th, { flex: 2 }]}>Instrument</Text>
            <Text style={[styles.th, { flex: 2 }]}>Latest observation</Text>
          </View>
          {provenance.byMetric.map((m) => (
            <View key={m.metric} style={styles.row}>
              <Text style={[styles.cell, { flex: 2 }]}>{METRIC_LABELS[m.metric]}</Text>
              <Text style={[styles.cell, { flex: 1 }]}>
                {m.origin === "satellite" ? "Satellite" : "Modelled"}
              </Text>
              <Text style={[styles.cellMuted, { flex: 2 }]}>{m.instrument ?? "—"}</Text>
              <Text style={[styles.cellMuted, { flex: 2 }]}>
                {m.origin === "satellite" ? formatObservedOn(m.observedOn) : "n/a"}
              </Text>
            </View>
          ))}
          {provenance.byMetric.some((m) => m.simulatedZones.length > 0) ? (
            <Text style={[styles.note, { marginTop: 6 }]}>
              Zones still modelled:{" "}
              {provenance.byMetric
                .filter((m) => m.origin === "satellite" && m.simulatedZones.length > 0)
                .map((m) => `${METRIC_LABELS[m.metric]} — ${m.simulatedZones.join(", ")}`)
                .join("; ")}
              . These are outside the current satellite subscription and are generated for
              demonstration.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basis &amp; limitations</Text>
          <Text style={styles.note}>
            The indicative value applies a base peri-urban land rate of{" "}
            {formatNad(REFERENCE.BASE_VALUE_PER_HA_NAD)} per hectare, adjusted by ±15% on the
            productivity score. Grazing capacity assumes a {REFERENCE.HA_PER_LSU_NORMAL} ha per LSU
            stocking rate in a normal season, scaled by observed conditions. The vegetation
            reference of {REFERENCE.PEAK_NDVI_REFERENCE} is the mean seasonal peak measured on this
            parcel across eight seasons, not a regional assumption.
          </Text>
          <Text style={[styles.note, { marginTop: 6 }]}>
            Satellite imagery is not acquired daily and optical observations can be lost to cloud.
            Figures show the most recent usable observation, dated above, rather than a live
            reading.
          </Text>
          <Text style={[styles.note, { marginTop: 6 }]}>
            This is a screening indication for portfolio monitoring, not a registered valuation. It
            does not account for improvements, water rights, servitudes, access or title, and does
            not replace a physical inspection.
          </Text>
          {provenance.anySatellite ? (
            <Text style={[styles.note, { marginTop: 6 }]}>{COPERNICUS_ATTRIBUTION}</Text>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text>Farm Information System · {snapshot.farm.name}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function RiskRow({
  label,
  detail,
  weight,
  deficit,
}: {
  label: string;
  detail: string;
  weight: number;
  deficit: number;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 3 }}>
        <Text style={styles.cell}>{label}</Text>
        <Text style={[styles.cellMuted, { fontSize: 7.5, marginTop: 1 }]}>{detail}</Text>
      </View>
      <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{Math.round(weight * 100)}%</Text>
      <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{deficit.toFixed(2)}</Text>
      <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>
        {Math.round(weight * deficit * 100)}
      </Text>
    </View>
  );
}
