/**
 * Vessel module — identity, dimensions, and live kinematic state.
 *
 * VesselState is populated from GPS in Alpha 0.1.x.
 * Future versions can merge AIS data from the community module.
 */

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
