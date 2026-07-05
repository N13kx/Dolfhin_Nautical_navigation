import type { MapMode } from './MapView';
import { Map, Image, Layers } from 'lucide-react';

interface LayerSheetProps {
  isOpen: boolean;
  activeMode: MapMode;
  onModeSelect: (mode: MapMode) => void;
  onClose: () => void;
}

export function LayerSheet({ isOpen, activeMode, onModeSelect, onClose }: LayerSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-[#071820]/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out translate-y-0 pb-[env(safe-area-inset-bottom,24px)] pt-6 px-4 glass-panel rounded-t-[32px] border-b-0 border-x-0">
        
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
        
        <h3 className="text-foreground font-semibold text-lg mb-4 ml-2">Kaartweergave</h3>
        
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
