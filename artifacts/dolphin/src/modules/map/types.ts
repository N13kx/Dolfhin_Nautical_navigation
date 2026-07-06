export type MapMode = 'Dolphin' | 'Satellite' | 'Hybrid';

/**
 * Tracking mode state machine:
 *  free      — camera is not locked to any position
 *  follow    — camera follows the vessel position (north-up)
 *  courseUp  — camera follows vessel AND rotates to heading
 *
 * Transitions:
 *  drag on map         → free
 *  tap locate (free)   → follow
 *  tap locate (follow) → courseUp
 *  tap locate (courseUp) → free + bearing reset (north-up)
 */
export type TrackingMode = 'free' | 'follow' | 'courseUp';

export interface MapCenterOptions {
  center?: [number, number];
  bearing?: number;
  zoom?: number;
  duration?: number;
}

export interface MapViewRef {
  getMap: () => import('maplibre-gl').Map | null;
  easeTo: (options: MapCenterOptions) => void;
}
