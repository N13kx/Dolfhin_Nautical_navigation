interface StatusStripProps {
  sog: number | null; // Speed over ground (knots)
  cog: number | null; // Course over ground (degrees)
  gpsAcc: number | null; // GPS Accuracy (meters)
}

export function StatusStrip({ sog, cog, gpsAcc }: StatusStripProps) {
  const formatValue = (val: number | null, precision: number = 0) => {
    if (val === null) return '—';
    return val.toFixed(precision);
  };

  return (
    <div className="fixed bottom-[env(safe-area-inset-bottom,16px)] left-[14px] right-[14px] h-[68px] z-40">
      <div className="glass-panel w-full h-full rounded-[21px] flex items-center shadow-xl backdrop-blur-xl">
        
        {/* SOG */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <span className="text-foreground font-mono text-[22px] font-bold leading-none tracking-tight">
            {formatValue(sog, 1)}
          </span>
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase mt-1">SOG (kts)</span>
          <div className="absolute right-0 top-[20%] bottom-[20%] w-[1px] bg-white/10" />
        </div>

        {/* COG */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <span className="text-foreground font-mono text-[22px] font-bold leading-none tracking-tight">
            {formatValue(cog, 0)}°
          </span>
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase mt-1">COG</span>
          <div className="absolute right-0 top-[20%] bottom-[20%] w-[1px] bg-white/10" />
        </div>

        {/* GPS */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="text-primary font-mono text-[22px] font-bold leading-none tracking-tight">
            {formatValue(gpsAcc, 0)}<span className="text-sm font-medium ml-[2px]">m</span>
          </span>
          <span className="text-primary/70 text-[10px] font-bold tracking-widest uppercase mt-1">GPS ACC</span>
        </div>

      </div>
    </div>
  );
}
