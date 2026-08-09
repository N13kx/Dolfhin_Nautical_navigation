/**
 * NauticalObjectSheet — bottom sheet for tapped official IENC features.
 *
 * Displays: dolphinKind label, charted value (with signed sounding model),
 * datum info, provenance (cell, dates from manifest), "Not real-time" disclaimer.
 *
 * ── DISPLAY RULES (from Task #8 brief) ───────────────────────────────
 * - Never show "Current depth", "Safe depth", or "Guaranteed clearance"
 * - Always show "Not real-time water depth" disclaimer
 * - Never convert an above-datum value into navigable depth
 * - sourceStableId may be null — show "—"
 * - issueDate / updateApplicationDate resolved from manifest — show "—" if null
 * ─────────────────────────────────────────────────────────────────────
 */

import type { MapGeoJSONFeature } from 'maplibre-gl';
import { X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { getCellMeta, formatManifestDate } from '../modules/nautical/manifestLoader';

export interface NauticalObjectSheetProps {
  feature: MapGeoJSONFeature | null;
  onClose: () => void;
}

/** Human-readable label for a dolphinKind value. */
function kindLabel(dolphinKind: string | undefined | null): string {
  switch (dolphinKind) {
    case 'beacon-special':  return 'Bijzonder baken';
    case 'buoy-lateral':    return 'Laterale boei';
    case 'buoy-special':    return 'Bijzondere boei';
    case 'light':           return 'Licht';
    case 'topmark':         return 'Topteken';
    case 'depth-area':      return 'Dieptegebied (DEPARE)';
    case 'depth-contour':   return 'Dieptelijn (DEPCNT)';
    case 'sounding':        return 'Peiling (SOUNDG)';
    default:                return dolphinKind ?? 'Nautisch object';
  }
}

/** Derives kind label from layer ID when dolphinKind is absent. */
function kindFromLayerId(layerId: string): string {
  if (layerId.includes('depth-areas'))    return 'Dieptegebied (DEPARE)';
  if (layerId.includes('depth-contours')) return 'Dieptelijn (DEPCNT)';
  if (layerId.includes('soundings'))      return 'Peiling (SOUNDG)';
  if (layerId.includes('nav-marks'))      return 'Navigatiemerk';
  return 'Nautisch object';
}

interface ChartedValueResult {
  label: string;
  value: string;
  relation: 'below' | 'above' | 'at' | null;
}

/** Derives the charted-value display from feature properties. */
function resolveChartedValue(props: Record<string, unknown>): ChartedValueResult | null {
  const relation = props.chartedValueRelationToDatum as string | undefined;
  const rawValue = props.chartedValueMetres;

  if (relation === 'below' && rawValue !== undefined && rawValue !== null) {
    const metres = Math.abs(Number(rawValue));
    return {
      label: 'Gepeilde diepte',
      value: `${metres.toFixed(1)} m onder Approximate LAT`,
      relation: 'below',
    };
  }
  if (relation === 'above' && rawValue !== undefined && rawValue !== null) {
    const metres = Number(rawValue);
    return {
      label: 'Drooghoogte',
      value: `${metres.toFixed(1)} m boven kaartdatum`,
      relation: 'above',
    };
  }
  if (relation === 'at') {
    return {
      label: 'Op kaartdatum',
      value: '0,0 m',
      relation: 'at',
    };
  }

  // Depth area: DRVAL1 / DRVAL2
  const drval1 = props.DRVAL1;
  const drval2 = props.DRVAL2;
  if (drval1 !== undefined && drval1 !== null && drval2 !== undefined && drval2 !== null) {
    const d1 = Math.abs(Number(drval1));
    const d2 = Math.abs(Number(drval2));
    return {
      label: 'Dieptebereik',
      value: `${Math.min(d1, d2).toFixed(1)} – ${Math.max(d1, d2).toFixed(1)} m (Approximate LAT)`,
      relation: null,
    };
  }

  // Depth contour: VALDCO
  const valdco = props.VALDCO;
  if (valdco !== undefined && valdco !== null) {
    return {
      label: 'Dieptelijn',
      value: `${Number(valdco).toFixed(1)} m (Approximate LAT)`,
      relation: null,
    };
  }

  return null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-muted-foreground text-[13px] shrink-0 pt-0.5">{label}</span>
      <span className="text-foreground text-[13px] text-right font-medium">{value}</span>
    </div>
  );
}

export function NauticalObjectSheet({ feature, onClose }: NauticalObjectSheetProps) {
  if (!feature) return null;

  const props = feature.properties as Record<string, unknown>;
  const layerId = feature.layer?.id ?? '';

  const dolphinKind = props.dolphinKind as string | undefined;
  const displayLabel = dolphinKind ? kindLabel(dolphinKind) : kindFromLayerId(layerId);

  const sourceCellId   = (props.sourceCellId as string | null | undefined) ?? null;
  const sourceStableId = (props.sourceStableId as string | null | undefined) ?? null;
  const pipelineId     = (props.pipelineFeatureId as string | null | undefined) ?? null;

  const cellMeta = sourceCellId ? getCellMeta(sourceCellId) : null;
  const issueDateDisplay  = formatManifestDate(cellMeta?.issueDate ?? null) ?? '—';
  const updateDateDisplay = formatManifestDate(cellMeta?.updateApplicationDate ?? null) ?? '—';

  const chartedValue = resolveChartedValue(props);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#071820]/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom,24px)] pt-5 px-4 glass-panel rounded-t-[28px] border-b-0 border-x-0">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-foreground font-semibold text-[17px] leading-snug">
              {displayLabel}
            </h3>
            {/* Official badge */}
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck size={13} className="text-[#44e4c2]" />
              <span className="text-[#44e4c2] text-[11px] font-medium uppercase tracking-wide">
                Officiële IENC-data
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
            aria-label="Sluiten"
          >
            <X size={18} className="text-foreground" />
          </button>
        </div>

        {/* Data rows */}
        <div className="mb-4">
          {chartedValue && (
            <Row
              label={chartedValue.label}
              value={
                <span
                  className={
                    chartedValue.relation === 'above'
                      ? 'text-amber-400'
                      : chartedValue.relation === 'at'
                        ? 'text-purple-400'
                        : 'text-[#44e4c2]'
                  }
                >
                  {chartedValue.value}
                </span>
              }
            />
          )}

          <Row
            label="Diepte-datum"
            value={
              <span className="flex items-center gap-1">
                Approximate LAT
                <ShieldCheck size={12} className="text-[#44e4c2] inline" />
              </span>
            }
          />

          <Row label="Cel" value={sourceCellId ?? '—'} />

          <Row
            label="Stabiel-ID"
            value={
              sourceStableId ? (
                <span className="font-mono text-[11px]">{sourceStableId}</span>
              ) : (
                '—'
              )
            }
          />

          <Row label="Uitgiftedatum" value={issueDateDisplay} />
          <Row label="Update toegepast" value={updateDateDisplay} />

          {pipelineId && (
            <Row
              label="Pipeline-ID"
              value={<span className="font-mono text-[11px] break-all">{pipelineId}</span>}
            />
          )}
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-500/30 rounded-[14px] p-3 mb-4">
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300/90 text-[12px] leading-relaxed">
            <span className="font-semibold">Geen realtime waterdiepte.</span>{' '}
            Dit zijn gepeilde diepten van de IENC-kaart — geen actueel waterpeil.
            Niet voor navigatie gebruiken.
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full bg-white/10 text-foreground font-semibold text-[15px] h-[48px] rounded-[14px] active:scale-[0.98] transition-transform mb-1"
        >
          Sluiten
        </button>
      </div>
    </>
  );
}
