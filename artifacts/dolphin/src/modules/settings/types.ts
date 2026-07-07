/**
 * Application settings — persisted locally with versioned schema.
 * No login required.
 */

export type ThemeMode = 'auto' | 'light' | 'dark';
export type MapModeDefault = 'Dolphin' | 'Satellite' | 'Hybrid';
export type OrientationMode = 'northUp' | 'courseUp';
export type SpeedUnit = 'knots' | 'kmh';
export type DepthUnit = 'meters' | 'feet' | 'fathoms';
export type DistanceUnit = 'nautical' | 'metric';

export interface UnitSettings {
  speed: SpeedUnit;
  depth: DepthUnit;
  distance: DistanceUnit;
}

export interface AppSettings {
  theme: ThemeMode;
  defaultMapMode: MapModeDefault;
  orientation: OrientationMode;
  units: UnitSettings;
  // Future settings — declared but not yet activated in the UI:
  // safetyMargins, privacy, communitySharing, notifications
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  defaultMapMode: 'Dolphin',
  orientation: 'northUp',
  units: {
    speed: 'knots',
    depth: 'meters',
    distance: 'nautical',
  },
};

/** Bump when the stored schema changes and migration is needed */
export const SETTINGS_SCHEMA_VERSION = 1;
