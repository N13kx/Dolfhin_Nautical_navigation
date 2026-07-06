import type { GpsQuality } from '../modules/navigation/types';
import { GPS_QUALITY_COLORS, GPS_QUALITY_LABELS } from '../modules/navigation/gpsUtils';

interface StatusStripProps {
  sog: number | null;      // Speed over ground, knots
  cog: number | null;      // Course over ground, degrees
  gpsAcc: number | null;   // GPS accuracy, meters
  gpsQuality: GpsQuality;
  isStale: boolean;        // Position data is older than threshold
}

export function StatusStrip({ sog, cog, gpsAcc, gpsQuality, isStale }: StatusStripProps) {
  const qualityColor = isStale ? '#ffffff33' : GPS_QUALITY_COLORS[gpsQuality];
  const qualityLabel = isStale ? 'Verlopen' : GPS_QUALITY_LABELS[gpsQuality];

  const formatSog = (val: number | null) =>
    val === null ? '—' : val.toFixed(1);

  const formatCog = (val: number | null) =>
    val === null ? '—' : Math.round(val).toString();

  return (
    <div className="fixed bottom-[env(safe-area-inset-bottom,16px)] left-[14px] right-[14px] h-[68px] z-40">
      <div className="glass-panel w-full h-full rounded-[21px] flex items-center shadow-xl backdrop-blur-xl">

        {/* SOG — Speed over ground */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <span className="text-foreground font-mono text-[22px] font-bold leading-none tracking-tight">
            {formatSog(sog)}
          </span>
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase mt-1">
            SOG (kts)
          </span>
          <div className="absolute right-0 top-[20%] bottom-[20%] w-[1px] bg-white/10" />
        </div>

        {/* COG — Course over ground */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <span className="text-foreground font-mono text-[22px] font-bold leading-none tracking-tight">
            {formatCog(cog)}{cog !== null ? '°' : ''}
          </span>
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase mt-1">
            COG
          </span>
          <div className="absolute right-0 top-[20%] bottom-[20%] w-[1px] bg-white/10" />
        </div>

        {/* GPS accuracy + quality indicator */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <span
            className="font-mono text-[22px] font-bold leading-none tracking-tight transition-colors duration-500"
            style={{ color: qualityColor }}
          >
            {gpsAcc !== null ? Math.round(gpsAcc) : '—'}
            {gpsAcc !== null && (
              <span className="text-sm font-medium ml-[2px]">m</span>
            )}
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase mt-1 transition-colors duration-500"
            style={{ color: qualityColor + 'bb' }}
          >
            {qualityLabel}
          </span>
        </div>

      </div>
    </div>
  );
}
