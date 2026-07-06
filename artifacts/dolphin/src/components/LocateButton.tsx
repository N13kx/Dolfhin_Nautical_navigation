import { Navigation } from 'lucide-react';
import type { TrackingMode } from '../modules/map/types';

interface LocateButtonProps {
  onClick: () => void;
  trackingMode: TrackingMode;
  hasPosition: boolean;
}

const ARIA_LABELS: Record<TrackingMode, string> = {
  free: 'Volg positie',
  follow: 'Koers omhoog',
  courseUp: 'Noord omhoog (vrije weergave)',
};

export function LocateButton({ onClick, trackingMode, hasPosition }: LocateButtonProps) {
  const isActive = trackingMode !== 'free';
  const isCourseUp = trackingMode === 'courseUp';

  return (
    <button
      onClick={onClick}
      aria-label={ARIA_LABELS[trackingMode]}
      className={`fixed right-[16px] bottom-[calc(env(safe-area-inset-bottom,16px)+96px)] w-[50px] h-[50px] rounded-[17px] glass-panel flex items-center justify-center transition-all shadow-xl z-40 hover:scale-[0.98] active:scale-95 ${
        isActive ? 'text-primary border-primary/30' : 'text-foreground'
      } ${!hasPosition ? 'opacity-60' : ''}`}
      data-testid="button-locate"
      data-tracking={trackingMode}
    >
      {/* courseUp: rotated filled arrow to indicate heading-lock */}
      {isCourseUp ? (
        <Navigation
          size={22}
          strokeWidth={2.5}
          className="fill-primary/30"
          style={{ transform: 'rotate(45deg)' }}
        />
      ) : (
        <Navigation
          size={22}
          strokeWidth={2.5}
          className={isActive ? 'fill-primary/20' : ''}
        />
      )}
    </button>
  );
}
