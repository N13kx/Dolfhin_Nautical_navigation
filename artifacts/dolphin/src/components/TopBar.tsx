import { Search, Layers } from 'lucide-react';

interface TopBarProps {
  onLayersClick: () => void;
  onSearchFocus: () => void;
}

export function TopBar({ onLayersClick, onSearchFocus }: TopBarProps) {
  return (
    <div className="fixed top-[env(safe-area-inset-top,12px)] left-[12px] right-[12px] h-[62px] z-40">
      <div className="glass-panel w-full h-full rounded-[20px] flex items-center justify-between px-3">

        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[13px] bg-gradient-to-br from-[#65f1d1] to-[#27aee8] flex items-center justify-center shadow-md">
            <span className="text-[#06232b] font-bold text-xl leading-none tracking-tight">D</span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-foreground font-bold tracking-widest text-[15px] leading-tight">DOLPHIN</span>
            <span className="text-primary font-medium text-[10px] tracking-wider uppercase leading-none mt-[2px]">
              Alpha 0.1.1
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSearchFocus}
            className="w-[42px] h-[42px] rounded-[14px] glass-button flex items-center justify-center text-foreground hover:text-primary transition-colors"
            data-testid="button-search"
            aria-label="Zoeken"
          >
            <Search size={20} strokeWidth={2.5} />
          </button>
          <button
            onClick={onLayersClick}
            className="w-[42px] h-[42px] rounded-[14px] glass-button flex items-center justify-center text-foreground hover:text-primary transition-colors"
            data-testid="button-layers"
            aria-label="Kaartlagen"
          >
            <Layers size={20} strokeWidth={2.5} />
          </button>
        </div>

      </div>
    </div>
  );
}
