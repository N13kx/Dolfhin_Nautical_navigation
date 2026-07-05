import { Navigation } from 'lucide-react';

interface LocateButtonProps {
  onClick: () => void;
  isTracking: boolean;
}

export function LocateButton({ onClick, isTracking }: LocateButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed right-[16px] bottom-[calc(env(safe-area-inset-bottom,16px)+96px)] w-[50px] h-[50px] rounded-[17px] glass-panel flex items-center justify-center transition-all shadow-xl z-40 hover:scale-[0.98] active:scale-95 ${
        isTracking ? 'text-primary border-primary/30' : 'text-foreground'
      }`}
      data-testid="button-locate"
    >
      <Navigation 
        size={22} 
        strokeWidth={2.5} 
        className={isTracking ? 'fill-primary/20' : ''} 
      />
    </button>
  );
}
