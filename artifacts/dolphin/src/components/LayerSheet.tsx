import type { MapMode } from './MapView';
import { Map, Image, Layers, Navigation, Waves, Radio } from 'lucide-react';

interface LayerSheetProps {
  isOpen: boolean;
  activeMode: MapMode;
  onModeSelect: (mode: MapMode) => void;
  onClose: () => void;
  /** Current per-group visibility state — from DolphinApp. */
  layerGroupVisibility: Record<string, boolean>;
  /** Called when the user toggles a layer group. */
  onToggleGroup: (groupId: string, visible: boolean) => void;
}

/**
 * Groups shown per mode.
 * Satellite has no IENC layers, so no toggles are shown.
 */
const MODE_GROUPS: Record<MapMode, Array<{ groupId: string; label: string; description: string; icon: React.ReactNode }>> = {
  Dolphin: [
    {
      groupId: 'nav-marks',
      label: 'Navigatiemerken',
      description: 'Officiële IENC-boeien en bakens',
      icon: <Navigation size={18} />,
    },
    {
      groupId: 'charted-depths',
      label: 'Gepeilde diepten',
      description: 'Dieptegebieden, -lijnen en peilingen',
      icon: <Waves size={18} />,
    },
  ],
  Satellite: [],
  Hybrid: [
    {
      groupId: 'nav-marks',
      label: 'Navigatiemerken',
      description: 'Officiële IENC-boeien en bakens',
      icon: <Navigation size={18} />,
    },
    {
      groupId: 'charted-depths',
      label: 'Gepeilde diepten',
      description: 'Dieptegebieden, -lijnen en peilingen',
      icon: <Waves size={18} />,
    },
    {
      groupId: 'community-seamarks',
      label: 'Community zeemerken',
      description: 'OpenSeaMap (community-data)',
      icon: <Radio size={18} />,
    },
  ],
};

export function LayerSheet({
  isOpen,
  activeMode,
  onModeSelect,
  onClose,
  layerGroupVisibility,
  onToggleGroup,
}: LayerSheetProps) {
  if (!isOpen) return null;

  const groups = MODE_GROUPS[activeMode];

  return (
    <>
      <div 
        className="fixed inset-0 bg-[#071820]/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out translate-y-0 pb-[env(safe-area-inset-bottom,24px)] pt-6 px-4 glass-panel rounded-t-[32px] border-b-0 border-x-0">
        
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
        
        <h3 className="text-foreground font-semibold text-lg mb-4 ml-2">Kaartweergave</h3>
        
        {/* Mode picker */}
        <div className="flex flex-col gap-3 mb-6">
          <LayerOption 
            mode="Dolphin" 
            title="Dolphin Nav" 
            description="Standaard nautische weergave"
            icon={<Map size={24} />}
            isActive={activeMode === 'Dolphin'}
            onClick={() => onModeSelect('Dolphin')}
          />
          <LayerOption 
            mode="Satellite" 
            title="Satelliet" 
            description="ESRI World Imagery"
            icon={<Image size={24} />}
            isActive={activeMode === 'Satellite'}
            onClick={() => onModeSelect('Satellite')}
          />
          <LayerOption 
            mode="Hybrid" 
            title="Hybride" 
            description="Satelliet met nautische overlay"
            icon={<Layers size={24} />}
            isActive={activeMode === 'Hybrid'}
            onClick={() => onModeSelect('Hybrid')}
          />
        </div>

        {/* Layer group toggles — only shown for modes with IENC layers */}
        {groups.length > 0 && (
          <>
            <div className="border-t border-white/10 pt-4 mb-4">
              <h4 className="text-muted-foreground text-[12px] font-medium uppercase tracking-wider mb-3 ml-1">
                Lagen
              </h4>
              <div className="flex flex-col gap-2">
                {groups.map(({ groupId, label, description, icon }) => (
                  <LayerToggle
                    key={groupId}
                    label={label}
                    description={description}
                    icon={icon}
                    isEnabled={layerGroupVisibility[groupId] ?? true}
                    onToggle={(enabled) => onToggleGroup(groupId, enabled)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <button 
          onClick={onClose}
          className="w-full bg-primary text-primary-foreground font-bold text-[16px] h-[54px] rounded-[17px] active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          Gereed
        </button>

      </div>
    </>
  );
}

function LayerOption({ 
  mode, 
  title, 
  description, 
  icon, 
  isActive, 
  onClick 
}: { 
  mode: string; 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  isActive: boolean; 
  onClick: () => void; 
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center p-4 rounded-[18px] transition-all text-left ${
        isActive 
          ? 'bg-primary/10 border-[1.5px] border-primary' 
          : 'bg-white/5 border border-white/5 hover:bg-white/10'
      }`}
    >
      <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center mr-4 ${isActive ? 'bg-primary/20 text-primary' : 'bg-black/20 text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className={`font-semibold text-[16px] mb-0.5 ${isActive ? 'text-primary' : 'text-foreground'}`}>
          {title}
        </div>
        <div className="text-muted-foreground text-[13px]">
          {description}
        </div>
      </div>
      <div className="w-6 h-6 rounded-full border-2 border-primary/30 flex items-center justify-center ml-2">
        {isActive && <div className="w-3 h-3 bg-primary rounded-full" />}
      </div>
    </button>
  );
}

function LayerToggle({
  label,
  description,
  icon,
  isEnabled,
  onToggle,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!isEnabled)}
      className="w-full flex items-center p-3.5 rounded-[16px] bg-white/5 border border-white/5 hover:bg-white/8 transition-all text-left"
    >
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center mr-3 flex-shrink-0 ${
        isEnabled ? 'bg-primary/20 text-primary' : 'bg-black/20 text-muted-foreground'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-[14px] ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </div>
        <div className="text-muted-foreground/70 text-[12px] truncate">
          {description}
        </div>
      </div>
      {/* Toggle pill */}
      <div
        className={`relative w-11 h-6 rounded-full ml-3 flex-shrink-0 transition-colors duration-200 ${
          isEnabled ? 'bg-primary' : 'bg-white/20'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isEnabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}
