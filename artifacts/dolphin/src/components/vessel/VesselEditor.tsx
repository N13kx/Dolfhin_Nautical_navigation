import { useState, useCallback } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import type { VesselProfile, VesselKind } from '../../modules/vessel/types';
import { validateVesselProfile } from '../../modules/vessel/vesselProfile';

const KIND_OPTIONS: { value: VesselKind; label: string; emoji: string }[] = [
  { value: 'sail', label: 'Zeilboot', emoji: '⛵' },
  { value: 'motor', label: 'Motorboot', emoji: '🚤' },
  { value: 'rib', label: 'RIB', emoji: '🛥️' },
  { value: 'barge', label: 'Schip / Barge', emoji: '🚢' },
  { value: 'other', label: 'Overig', emoji: '⚓' },
];

interface VesselEditorProps {
  initial: VesselProfile | null;
  onSave: (profile: VesselProfile) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function uid(): string {
  return `vessel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function optionalNum(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function VesselEditor({ initial, onSave, onDelete, onClose }: VesselEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<VesselKind>(initial?.kind ?? 'motor');
  const [length, setLength] = useState(initial?.lengthMeters?.toString() ?? '');
  const [beam, setBeam] = useState(initial?.beamMeters?.toString() ?? '');
  const [draft, setDraft] = useState(initial?.draftMeters?.toString() ?? '');
  const [airDraft, setAirDraft] = useState(initial?.airDraftMeters?.toString() ?? '');
  const [cruising, setCruising] = useState(initial?.cruisingSpeedKnots?.toString() ?? '');
  const [maxSpeed, setMaxSpeed] = useState(initial?.maxSpeedKnots?.toString() ?? '');
  const [homePort, setHomePort] = useState(initial?.homePort ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSave = useCallback(() => {
    const draft_profile: Partial<VesselProfile> = {
      name,
      kind,
      lengthMeters: optionalNum(length),
      beamMeters: optionalNum(beam),
      draftMeters: optionalNum(draft),
      airDraftMeters: optionalNum(airDraft),
      cruisingSpeedKnots: optionalNum(cruising),
      maxSpeedKnots: optionalNum(maxSpeed),
      homePort: homePort.trim() || undefined,
    };

    const errs = validateVesselProfile(draft_profile);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    onSave({
      id: initial?.id ?? uid(),
      name: name.trim(),
      kind,
      ...draft_profile,
    } as VesselProfile);
  }, [name, kind, length, beam, draft, airDraft, cruising, maxSpeed, homePort, initial, onSave]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,16px)] pb-3 border-b border-border">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all"
        >
          <X size={22} className="text-muted-foreground" />
        </button>
        <h2 className="font-bold text-foreground text-[17px]">
          {initial ? 'Vaartuig bewerken' : 'Nieuw vaartuig'}
        </h2>
        <button
          onClick={handleSave}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/15 hover:bg-primary/25 active:scale-90 transition-all"
        >
          <Check size={20} className="text-primary" />
        </button>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom,24px)]">
        {errors.length > 0 && (
          <div className="mt-4 p-3 rounded-[14px] bg-destructive/10 border border-destructive/20">
            {errors.map((e, i) => (
              <p key={i} className="text-destructive text-[13px]">{e}</p>
            ))}
          </div>
        )}

        {/* Name */}
        <Section title="Naam">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam van je vaartuig"
            className="w-full bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground outline-none"
            autoCapitalize="words"
          />
        </Section>

        {/* Type */}
        <Section title="Type">
          <div className="grid grid-cols-3 gap-2 py-1">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setKind(opt.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px] border transition-all ${
                  kind === opt.value
                    ? 'bg-primary/12 border-primary text-primary'
                    : 'bg-white/5 border-white/8 text-muted-foreground'
                }`}
              >
                <span className="text-2xl leading-none">{opt.emoji}</span>
                <span className="text-[11px] font-medium leading-tight text-center">{opt.label}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Dimensions */}
        <Section title="Afmetingen">
          <div className="space-y-0 divide-y divide-border/50">
            <NumRow label="Lengte" unit="m" value={length} onChange={setLength} placeholder="bv. 9.5" />
            <NumRow label="Breedte" unit="m" value={beam} onChange={setBeam} placeholder="bv. 3.2" />
            <NumRow label="Diepgang" unit="m" value={draft} onChange={setDraft} placeholder="bv. 1.2" />
            <NumRow label="Doorvaarthoogte" unit="m" value={airDraft} onChange={setAirDraft} placeholder="bv. 14.5" />
          </div>
        </Section>

        {/* Speed */}
        <Section title="Snelheid">
          <div className="space-y-0 divide-y divide-border/50">
            <NumRow label="Kruissnelheid" unit="kts" value={cruising} onChange={setCruising} placeholder="bv. 6" />
            <NumRow label="Maximumsnelheid" unit="kts" value={maxSpeed} onChange={setMaxSpeed} placeholder="optioneel" />
          </div>
        </Section>

        {/* Home port */}
        <Section title="Thuishaven (optioneel)">
          <input
            type="text"
            value={homePort}
            onChange={(e) => setHomePort(e.target.value)}
            placeholder="bv. Hellevoetsluis"
            className="w-full bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground outline-none"
          />
        </Section>

        {/* Delete */}
        {initial && onDelete && (
          <button
            onClick={onDelete}
            className="mt-6 mb-4 w-full flex items-center justify-center gap-2 p-4 rounded-[17px] text-destructive border border-destructive/20 hover:bg-destructive/10 active:scale-[0.98] transition-all"
          >
            <Trash2 size={18} />
            <span className="font-medium text-[15px]">Vaartuig verwijderen</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-muted-foreground text-[12px] font-medium uppercase tracking-wider mb-2 ml-1">
        {title}
      </p>
      <div className="glass-panel rounded-[18px] px-4 py-3">{children}</div>
    </div>
  );
}

function NumRow({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex-1 text-foreground text-[15px]">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-24 text-right bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground/50 outline-none"
      />
      <span className="text-muted-foreground text-[13px] w-8">{unit}</span>
    </div>
  );
}
