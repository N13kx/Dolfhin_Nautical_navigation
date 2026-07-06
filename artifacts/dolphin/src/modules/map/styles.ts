import type { StyleSpecification } from 'maplibre-gl';
import type { MapMode } from './types';

/** Dolphin Nav: OpenStreetMap raster */
const DOLPHIN_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 22 },
  ],
};

/** Satellite: ESRI World Imagery */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    },
  },
  layers: [
    { id: 'esri-satellite', type: 'raster', source: 'esri', minzoom: 0, maxzoom: 22 },
  ],
};

/**
 * Hybrid uses satellite imagery as base (same tiles as Satellite mode).
 * Defined as a SEPARATE object literal so that setStyle always receives a
 * distinct reference, guaranteeing MapLibre fires the styledata event even
 * when toggling Satellite ↔ Hybrid. overlayManager adds OpenSeaMap on top.
 */
const HYBRID_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    },
  },
  layers: [
    { id: 'esri-satellite', type: 'raster', source: 'esri', minzoom: 0, maxzoom: 22 },
  ],
};

export const MAP_STYLES: Record<MapMode, StyleSpecification> = {
  Dolphin: DOLPHIN_STYLE,
  Satellite: SATELLITE_STYLE,
  Hybrid: HYBRID_STYLE,
};
