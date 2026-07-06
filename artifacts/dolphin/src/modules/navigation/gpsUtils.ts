import type { GpsQuality } from './types';

/** Position data older than this is marked as stale */
export const STALE_THRESHOLD_MS = 10_000;

/** Interval at which we check for staleness */
export const STALE_CHECK_INTERVAL_MS = 5_000;

/** m/s to knots conversion factor */
export const MS_TO_KNOTS = 1.94384;

export function metersPerSecondToKnots(ms: number): number {
  return ms * MS_TO_KNOTS;
}

export function isPositionStale(timestamp: number): boolean {
  return Date.now() - timestamp > STALE_THRESHOLD_MS;
}

/**
 * Accuracy thresholds:
 *  good     ≤ 10 m — reliable positioning
 *  moderate ≤ 30 m — usable for navigation
 *  poor     > 30 m — do not rely on position
 */
export function getGpsQuality(accuracyMeters: number): GpsQuality {
  if (accuracyMeters <= 10) return 'good';
  if (accuracyMeters <= 30) return 'moderate';
  return 'poor';
}

export const GPS_QUALITY_LABELS: Record<GpsQuality, string> = {
  good: 'Goed',
  moderate: 'Matig',
  poor: 'Slecht',
  none: 'GPS',
};

export const GPS_QUALITY_COLORS: Record<GpsQuality, string> = {
  good: '#44e4c2',   // teal — brand primary
  moderate: '#f5a623', // amber
  poor: '#e25555',   // red
  none: '#ffffff66', // muted white
};
