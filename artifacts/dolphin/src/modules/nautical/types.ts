/**
 * Nautical module — ENC chart data, waterway objects, depths, locks, bridges.
 *
 * NauticalDataProvider is a placeholder interface. No implementation exists in
 * Alpha 0.1.x. Future versions can plug in OpenCPN, IENC, or proprietary ENC
 * data sources without changing the rest of the codebase.
 */

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type NauticalObjectType =
  | 'lock'
  | 'bridge'
  | 'buoy'
  | 'lateral_mark'
  | 'cardinal_mark'
  | 'port'
  | 'marina'
  | 'anchorage'
  | 'hazard'
  | 'fuel'
  | 'water';

export interface NauticalObject {
  id: string;
  type: NauticalObjectType;
  name?: string;
  center: [number, number]; // [lng, lat]
  properties: Record<string, unknown>;
}

export interface DepthContour {
  depth: number;        // meters below chart datum
  coordinates: [number, number][]; // [lng, lat]
}

/**
 * NauticalDataProvider — pluggable chart and waterway data source.
 * Not implemented in Alpha 0.1.x.
 */
export interface NauticalDataProvider {
  readonly name: string;
  readonly version: string;

  /** Waterway objects (locks, bridges, buoys, etc.) within a bounding box */
  fetchObjects(bbox: BBox): Promise<NauticalObject[]>;

  /** Depth contours within a bounding box */
  fetchDepthContours(bbox: BBox): Promise<DepthContour[]>;
}
