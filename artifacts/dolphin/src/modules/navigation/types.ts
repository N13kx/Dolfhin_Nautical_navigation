/**
 * Navigation module — core position and GPS types.
 *
 * PositionProvider is a replaceable interface. The browser Geolocation API
 * is the only implementation in Alpha 0.1.x. Future versions can plug in
 * NMEA-over-BLE, AIS, or external GPS receivers without changing consumers.
 */

export type GpsQuality = 'good' | 'moderate' | 'poor' | 'none';

export type GpsErrorCode =
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'unknown';

export interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;      // meters — horizontal accuracy radius
  heading: number | null; // degrees true north; null when stationary or unavailable
  speed: number | null;  // m/s; null when unavailable
  timestamp: number;     // ms since epoch (from browser Position.timestamp)
  isStale: boolean;      // true when data is older than STALE_THRESHOLD_MS
}

export interface GpsError {
  code: GpsErrorCode;
  message: string;
}

/**
 * PositionProvider — pluggable GPS/AIS/NMEA source.
 * Not yet used as a formal interface in Alpha 0.1.x, but defined here so
 * consumers can be written against the interface rather than the hook directly.
 */
export interface PositionProvider {
  readonly position: GpsPosition | null;
  readonly quality: GpsQuality;
  readonly error: GpsError | null;
  readonly isTracking: boolean;
  start(): void;
  stop(): void;
}
