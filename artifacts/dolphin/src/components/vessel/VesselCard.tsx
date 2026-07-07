import { Anchor, ChevronRight } from 'lucide-react';
import type { VesselProfile } from '../../modules/vessel/types';

const KIND_LABELS: Record<string, string> = {
  sail: 'Zeilboot',
  motor: 'Motorboot',
  rib: 'RIB',
  barge: 'Schip / Barge',
  other: 'Overig',
};

const KIND_EMOJI: Record<string, string> = {
  sail: '⛵',
  motor: '🚤',
  rib: '🛥️',
  barge: '🚢',
  other: '⚓',
};

interface VesselCardProps {
  profile: VesselProfile | null;
  onEdit: () => void;
}

export function VesselCard({ profile, onEdit }: VesselCardProps) {
  if (!profile) {
    return (
      <button
        onClick={onEdit}
        className="w-full flex items-center gap-4 p-4 rounded-[18px] bg-primary/8 border border-primary/20 hover:bg-primary/15 active:scale-[0.98] transition-all text-left"
      >
        <div className="w-12 h-12 rounded-[14px] bg-primary/15 flex items-center justify-center text-primary">
          <Anchor size={22} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground text-[15px]">Mijn vaartuig instellen</p>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            Voer afmetingen in voor brug- en sluiswaarschuwingen
          </p>
        </div>
        <ChevronRight size={18} className="text-muted-foreground" />
      </button>
    );
  }

  const dims: string[] = [];
  if (profile.lengthMeters != null) dims.push(`${profile.lengthMeters} m lang`);
  if (profile.beamMeters != null) dims.push(`${profile.beamMeters} m breed`);
  if (profile.draftMeters != null) dims.push(`${profile.draftMeters} m diepgang`);

  return (
    <button
      onClick={onEdit}
      className="w-full flex items-center gap-4 p-4 rounded-[18px] bg-white/5 dark:bg-white/5 light:bg-black/3 border border-white/8 hover:bg-white/10 active:scale-[0.98] transition-all text-left"
    >
      <div className="w-12 h-12 rounded-[14px] bg-primary/15 flex items-center justify-center text-2xl leading-none">
        {KIND_EMOJI[profile.kind] ?? '⚓'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-[15px] truncate">{profile.name}</p>
        <p className="text-muted-foreground text-[12px] mt-0.5">
          {KIND_LABELS[profile.kind] ?? profile.kind}
          {dims.length > 0 && ` · ${dims.join(' · ')}`}
        </p>
      </div>
      <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
    </button>
  );
}
