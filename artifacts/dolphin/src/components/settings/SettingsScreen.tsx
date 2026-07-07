import { useState } from 'react';
import {
  X,
  ChevronRight,
  Sun,
  Moon,
  SunMoon,
  Compass,
  Gauge,
  Anchor,
  Shield,
  Info,
  Map,
} from 'lucide-react';
import { useSettings } from '../../modules/settings/SettingsContext';
import { useVesselProfile } from '../../modules/vessel/VesselProfileContext';
import { VesselCard } from '../vessel/VesselCard';
import { VesselEditor } from '../vessel/VesselEditor';
import type { ThemeMode, MapModeDefault } from '../../modules/settings/types';

interface SettingsScreenProps {
  onClose: () => void;
}

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { settings, updateSettings } = useSettings();
  const { profile, setProfile, clearProfile } = useVesselProfile();
  const [vesselEditorOpen, setVesselEditorOpen] = useState(false);

  if (vesselEditorOpen) {
    return (
      <VesselEditor
        initial={profile}
        onSave={(p) => {
          setProfile(p);
          setVesselEditorOpen(false);
        }}
        onDelete={profile ? () => { clearProfile(); setVesselEditorOpen(false); } : undefined}
        onClose={() => setVesselEditorOpen(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,16px)] pb-3 border-b border-border flex-shrink-0">
        <div />
        <h2 className="font-bold text-foreground text-[17px]">Instellingen</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all"
        >
          <X size={22} className="text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom,24px)]">

        {/* My Vessel */}
        <SectionHeader icon={<Anchor size={16} />} title="Mijn vaartuig" />
        <VesselCard profile={profile} onEdit={() => setVesselEditorOpen(true)} />

        {/* Appearance */}
        <SectionHeader icon={<Sun size={16} />} title="Weergave" />
        <div className="glass-panel rounded-[18px] divide-y divide-border/50 overflow-hidden">
          <SettingRow label="Thema">
            <ThemePicker
              value={settings.theme}
              onChange={(v) => updateSettings({ theme: v })}
            />
          </SettingRow>
        </div>

        {/* Map */}
        <SectionHeader icon={<Map size={16} />} title="Kaart" />
        <div className="glass-panel rounded-[18px] divide-y divide-border/50 overflow-hidden">
          <SettingRow label="Standaard kaartmodus">
            <MapModePicker
              value={settings.defaultMapMode}
              onChange={(v) => updateSettings({ defaultMapMode: v })}
            />
          </SettingRow>
        </div>

        {/* Navigation */}
        <SectionHeader icon={<Compass size={16} />} title="Navigatie" />
        <div className="glass-panel rounded-[18px] divide-y divide-border/50 overflow-hidden">
          <SettingRow label="Oriëntatie">
            <SegmentedControl
              options={[
                { value: 'northUp', label: 'Noord' },
                { value: 'courseUp', label: 'Koers' },
              ]}
              value={settings.orientation}
              onChange={(v) => updateSettings({ orientation: v as 'northUp' | 'courseUp' })}
            />
          </SettingRow>
        </div>

        {/* Units */}
        <SectionHeader icon={<Gauge size={16} />} title="Eenheden" />
        <div className="glass-panel rounded-[18px] divide-y divide-border/50 overflow-hidden">
          <SettingRow label="Snelheid">
            <SegmentedControl
              options={[
                { value: 'knots', label: 'kts' },
                { value: 'kmh', label: 'km/h' },
              ]}
              value={settings.units.speed}
              onChange={(v) => updateSettings({ units: { ...settings.units, speed: v as 'knots' | 'kmh' } })}
            />
          </SettingRow>
          <SettingRow label="Diepte">
            <SegmentedControl
              options={[
                { value: 'meters', label: 'm' },
                { value: 'feet', label: 'ft' },
                { value: 'fathoms', label: 'fm' },
              ]}
              value={settings.units.depth}
              onChange={(v) => updateSettings({ units: { ...settings.units, depth: v as 'meters' | 'feet' | 'fathoms' } })}
            />
          </SettingRow>
          <SettingRow label="Afstand">
            <SegmentedControl
              options={[
                { value: 'nautical', label: 'NM' },
                { value: 'metric', label: 'km' },
              ]}
              value={settings.units.distance}
              onChange={(v) => updateSettings({ units: { ...settings.units, distance: v as 'nautical' | 'metric' } })}
            />
          </SettingRow>
        </div>

        {/* Privacy (placeholder) */}
        <SectionHeader icon={<Shield size={16} />} title="Privacy" />
        <div className="glass-panel rounded-[18px] px-4 py-4">
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            Dolphin deelt geen locatiegegevens. Routeplanning en
            community-functies zijn beschikbaar in een toekomstige versie.
          </p>
        </div>

        {/* About */}
        <SectionHeader icon={<Info size={16} />} title="Over Dolphin" />
        <div className="glass-panel rounded-[18px] divide-y divide-border/50 overflow-hidden">
          <StaticRow label="Versie" value="0.2.0 Alpha" />
          <StaticRow label="Kaartdata" value="OpenStreetMap, PDOK/RWS" />
          <StaticRow label="Nautisch" value="PDOK VNDS CC0 1.0" />
          <StaticRow label="Satelietbeelden" value="Esri World Imagery" />
          <StaticRow label="Zeemerken (community)" value="OpenSeaMap" />
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-2 ml-1">
      <span className="text-primary">{icon}</span>
      <p className="text-muted-foreground text-[12px] font-semibold uppercase tracking-wider">
        {title}
      </p>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-foreground text-[15px]">{label}</span>
      {children}
    </div>
  );
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-muted-foreground text-[14px]">{label}</span>
      <span className="text-foreground text-[14px] text-right">{value}</span>
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-[10px] bg-white/8 p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all ${
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (v: ThemeMode) => void;
}) {
  const options: { value: ThemeMode; icon: React.ReactNode }[] = [
    { value: 'auto', icon: <SunMoon size={16} /> },
    { value: 'light', icon: <Sun size={16} /> },
    { value: 'dark', icon: <Moon size={16} /> },
  ];
  return (
    <div className="flex rounded-[10px] bg-white/8 p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`w-9 h-8 flex items-center justify-center rounded-[8px] transition-all ${
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

function MapModePicker({
  value,
  onChange,
}: {
  value: MapModeDefault;
  onChange: (v: MapModeDefault) => void;
}) {
  const options: { value: MapModeDefault; label: string }[] = [
    { value: 'Dolphin', label: 'Nav' },
    { value: 'Satellite', label: 'Sat' },
    { value: 'Hybrid', label: 'Hybr' },
  ];
  return (
    <div className="flex rounded-[10px] bg-white/8 p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all ${
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ChevronRight() {
  return <ChevronRight size={16} className="text-muted-foreground" />;
}
