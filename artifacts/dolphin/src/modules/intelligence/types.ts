/**
 * Intelligence module — AI-assisted route planning, hazard detection, and
 * passage briefings.
 *
 * All types are placeholders. No implementation exists in Alpha 0.1.x.
 * Future versions can integrate LLM-based route advice, ETA predictions,
 * and weather-aware passage planning without changing the rest of the codebase.
 */

export interface RouteRequest {
  from: [number, number];         // [lng, lat]
  to: [number, number];           // [lng, lat]
  departAt?: number;              // ms since epoch
  vesselDraughtMeters?: number;
  vesselAirdraftMeters?: number;
  preferScenic?: boolean;
}

export interface RouteHazard {
  position: [number, number];
  type: 'shoal' | 'bridge' | 'lock' | 'restricted_area' | 'strong_current';
  description: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface PlannedRoute {
  waypoints: [number, number][];
  distanceNm: number;
  estimatedDurationHours: number;
  hazards: RouteHazard[];
  passages: PassageNote[];
}

export interface PassageNote {
  position: [number, number];
  note: string;
  type: 'lock_timing' | 'bridge_clearance' | 'speed_limit' | 'anchorage';
}
