import type { Map, SourceSpecification, LayerSpecification } from 'maplibre-gl';
import type { MapMode } from './types';

export interface OverlaySpec {
  sourceId: string;
  source: SourceSpecification;
  layerId: string;
  layer: LayerSpecification;
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

/** Overlays shown in Dolphin nav mode */
const DOLPHIN_OVERLAYS: OverlaySpec[] = [
  {
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
  },
];

/** Overlays shown in Hybrid mode: OpenSeaMap seamark tiles + demo route */
const HYBRID_OVERLAYS: OverlaySpec[] = [
  {
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
  },
  // Also show the demo route in hybrid
  {
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
  },
];

const OVERLAYS_BY_MODE: Record<MapMode, OverlaySpec[]> = {
  Dolphin: DOLPHIN_OVERLAYS,
  Satellite: [],
  Hybrid: HYBRID_OVERLAYS,
};

/** Returns the overlay specs for a given map mode. */
export function getOverlaysForMode(mode: MapMode): OverlaySpec[] {
  return OVERLAYS_BY_MODE[mode];
}

/**
 * Applies overlays to the map. Safe to call multiple times — idempotent.
 * Called once on initial load and again after every style swap (styledata event).
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
      // Style may still be loading — the next styledata event will retry
    }
  }
}
