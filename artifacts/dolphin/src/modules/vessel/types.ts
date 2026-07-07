/**
 * Vessel module — vessel profile, identity, and live kinematic state.
 */

// ---------------------------------------------------------------------------
// Vessel Profile — the user's own vessel configuration (persisted locally)
// ---------------------------------------------------------------------------

export type VesselKind = 'sail' | 'motor' | 'rib' | 'barge' | 'other';

export interface VesselProfile {
  /** Unique identifier generated on first save */
  id: string;
  name: string;
  kind: VesselKind;
  lengthMeters?: number;
  beamMeters?: number;
  /** Static draught, meters */
  draftMeters?: number;
  /** Air draft — maximum height above waterline, meters */
  airDraftMeters?: number;
  /** Normal cruising speed, knots */
  cruisingSpeedKnots?: number;
  /** Maximum speed, knots (optional) */
  maxSpeedKnots?: number;
  /** Home port name (optional) */
  homePort?: string;
}

// ---------------------------------------------------------------------------
// Legacy AIS / community vessel types (retained for future AIS integration)
// ---------------------------------------------------------------------------

export type VesselType =
  | 'sailing'
  | 'motorboat'
  | 'ship'
  | 'kayak'
  | 'standup_paddle'
  | 'unknown';

/** Static identity and physical dimensions of the vessel */
export interface Vessel {
  id: string;
  name: string;
  type: VesselType;
  mmsi?: string;          // Maritime Mobile Service Identity
  callSign?: string;
  lengthMeters?: number;
  beamMeters?: number;
  draughtMeters?: number;
  airdraftMeters?: number; // clearance height — relevant for bridges
}

/** Live kinematic state derived from GPS or AIS */
export interface VesselState {
  position: [number, number]; // [lng, lat]
  heading: number | null;     // degrees true north; null when stationary
  sog: number | null;         // speed over ground, knots
  cog: number | null;         // course over ground, degrees true
  updatedAt: number;          // ms since epoch
}
