import type { Map, SourceSpecification, LayerSpecification } from 'maplibre-gl';
import type { MapMode } from './types';
import { getIencOverlaySpecs, IENC_LAYER_IDS } from '../nautical/iencLayers';

export interface OverlaySpec {
  sourceId: string;
  source: SourceSpecification;
  layerId: string;
  layer: LayerSpecification;
  /**
   * Optional group identifier for visibility toggling.
   * When present, applyLayerGroupVisibility() sets the layer's MapLibre
   * visibility according to the provided group → boolean map.
   *
   * Group IDs used in Dolphin:
   *   "nav-marks"          — official IENC navigation marks
   *   "charted-depths"     — IENC depth areas, contours, soundings
   *   "community-seamarks" — OpenSeaMap raster overlay
   */
  groupId?: string;
}

const DEMO_ROUTE_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [4.265, 51.49],
          [4.33, 51.54],
          [4.39, 51.59],
          [4.43, 51.66],
        ],
      },
      properties: {},
    },
  ],
};

// Initialise IENC overlay specs once — BASE_URL is a static string replaced by Vite at build time.
const IENC_SPECS: OverlaySpec[] = getIencOverlaySpecs(import.meta.env.BASE_URL);

const DEMO_ROUTE_SPEC: OverlaySpec = {
  sourceId: 'demo-route',
  source: { type: 'geojson', data: DEMO_ROUTE_GEOJSON },
  layerId: 'demo-route-line',
  layer: {
    id: 'demo-route-line',
    type: 'line',
    source: 'demo-route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#44e4c2', 'line-width': 5, 'line-opacity': 0.9 },
  },
  // No groupId — demo route has no user toggle
};

const OPENSEAMAP_SPEC: OverlaySpec = {
  sourceId: 'openseamap',
  source: {
    type: 'raster',
    tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© OpenSeaMap contributors',
  },
  layerId: 'openseamap-layer',
  layer: {
    id: 'openseamap-layer',
    type: 'raster',
    source: 'openseamap',
    minzoom: 0,
    maxzoom: 22,
    paint: { 'raster-opacity': 0.9 },
  },
  groupId: 'community-seamarks',
};

/** Overlays shown in Dolphin nav mode: demo route + official IENC data */
const DOLPHIN_OVERLAYS: OverlaySpec[] = [
  DEMO_ROUTE_SPEC,
  ...IENC_SPECS,
];

/**
 * Overlays shown in Hybrid mode: OpenSeaMap (community-seamarks, OFF by default)
 * + demo route + official IENC data.
 *
 * OpenSeaMap carries groupId "community-seamarks" so it starts hidden until the
 * user explicitly enables it via the layer toggle in LayerSheet.
 */
const HYBRID_OVERLAYS: OverlaySpec[] = [
  OPENSEAMAP_SPEC,
  DEMO_ROUTE_SPEC,
  ...IENC_SPECS,
];

const OVERLAYS_BY_MODE: Record<MapMode, OverlaySpec[]> = {
  Dolphin:   DOLPHIN_OVERLAYS,
  Satellite: [],
  Hybrid:    HYBRID_OVERLAYS,
};

/**
 * Which base tile set each mode uses.
 *
 * Satellite and Hybrid share the same ESRI base, so switching between them
 * must NOT call setStyle — MapLibre's diff algorithm produces a zero-diff and
 * emits no lifecycle events, meaning style.load / styledata never fires and
 * overlays are never applied. Instead, overlay reconciliation runs directly.
 */
export type BaseStyleGroup = 'osm' | 'esri';

export const BASE_STYLE_GROUP: Record<MapMode, BaseStyleGroup> = {
  Dolphin:   'osm',
  Satellite: 'esri',
  Hybrid:    'esri',
};

/** Returns the overlay specs for a given map mode. */
export function getOverlaysForMode(mode: MapMode): OverlaySpec[] {
  return OVERLAYS_BY_MODE[mode];
}

/**
 * Applies overlays to the map. Safe to call multiple times — idempotent.
 * Called once on initial load and again after every real style swap.
 */
export function applyOverlays(map: Map, overlays: OverlaySpec[]): void {
  for (const overlay of overlays) {
    try {
      if (!map.getSource(overlay.sourceId)) {
        map.addSource(overlay.sourceId, overlay.source);
      }
      if (!map.getLayer(overlay.layerId)) {
        map.addLayer(overlay.layer);
      }
    } catch {
      // Style may still be initialising — handled by caller
    }
  }
}

/**
 * Removes overlays from the map. Safe to call if sources/layers are absent.
 * Layers are removed before their sources (MapLibre requirement).
 * Overlays are processed in reverse order to respect potential dependencies.
 */
export function removeOverlays(map: Map, overlays: OverlaySpec[]): void {
  for (const overlay of [...overlays].reverse()) {
    try {
      if (map.getLayer(overlay.layerId)) {
        map.removeLayer(overlay.layerId);
      }
    } catch { /* ignore */ }
    try {
      if (map.getSource(overlay.sourceId)) {
        map.removeSource(overlay.sourceId);
      }
    } catch { /* ignore */ }
  }
}

/**
 * Sets MapLibre layer visibility for each overlay that carries a groupId.
 * Must be called after applyOverlays to ensure the layers exist.
 *
 * Layers without a groupId are left at their default (visible).
 * Layers whose groupId is absent from the visibility map default to visible.
 */
export function applyLayerGroupVisibility(
  map: Map,
  overlays: OverlaySpec[],
  visibility: Record<string, boolean>
): void {
  for (const overlay of overlays) {
    if (!overlay.groupId) continue;
    // Default to visible when groupId is not in the visibility map
    const visible = overlay.groupId in visibility ? visibility[overlay.groupId] : true;
    try {
      if (map.getLayer(overlay.layerId)) {
        map.setLayoutProperty(overlay.layerId, 'visibility', visible ? 'visible' : 'none');
      }
    } catch { /* layer may not exist yet; applyOverlays will add it */ }
  }
}

/**
 * Layer IDs that represent official IENC data — exported for external use
 * (e.g. registering click handlers in MapView).
 */
export { IENC_LAYER_IDS };
