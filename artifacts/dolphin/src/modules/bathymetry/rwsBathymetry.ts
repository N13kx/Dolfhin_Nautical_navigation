import type { OverlaySpec } from '../map/overlayManager';

export const RWS_BATHYMETRY_EXPERIMENT_ENABLED =
  import.meta.env.VITE_RWS_BATHYMETRY_EXPERIMENT === '1';

export const RWS_BATHYMETRY_GROUP_ID = 'rws-bottom-elevation-experiment';

export const RWS_BATHYMETRY_PROVENANCE = Object.freeze({
  publisher: 'Rijkswaterstaat',
  dataset: 'Bathymetrie Nederland – binnenwateren 1 m, January 2026',
  sourceCategory: 'B_MEASURED_BATHYMETRY',
  horizontalCRS: 'EPSG:28992',
  verticalReference: 'NAP / EPSG:5709',
  units: 'metres relative to NAP',
  sourceUrl:
    'https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_1mtr_historie/wcs',
  coverageId: 'bodemhoogte_1mtr_historie__bodemhoogte_1mtr_202601',
  datasetSnapshotDate: '2026-01-01',
  measurementDate: null,
  measurementDateStatus: 'UNKNOWN',
  derived: false,
  navigationSuitable: false,
});

const IMAGE_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [4.303533600022973, 51.64771523264675],
  [4.304978248662828, 51.647728599808254],
  [4.304999720840752, 51.64682987666399],
  [4.303555100856431, 51.646816509848335],
];

/**
 * Experimental display of measured RWS bottom elevation relative to NAP.
 * This is not IENC data, water depth, charted depth, or safe depth.
 */
export function getRwsBathymetryOverlaySpecs(baseUrl: string): OverlaySpec[] {
  if (!RWS_BATHYMETRY_EXPERIMENT_ENABLED) return [];

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const sourceId = 'rws-bottom-elevation-smoke-source';

  return [
    {
      sourceId,
      source: {
        type: 'image',
        url: `${normalizedBase}rws-bathymetry/rws-bottom-elevation-202601-smoke.png`,
        coordinates: IMAGE_COORDINATES,
      },
      layerId: 'rws-bottom-elevation-smoke-raster',
      layer: {
        id: 'rws-bottom-elevation-smoke-raster',
        type: 'raster',
        source: sourceId,
        minzoom: 9,
        maxzoom: 22,
        paint: {
          'raster-opacity': 0.72,
          'raster-resampling': 'nearest',
          'raster-fade-duration': 0,
        },
      },
      groupId: RWS_BATHYMETRY_GROUP_ID,
    },
  ];
}
