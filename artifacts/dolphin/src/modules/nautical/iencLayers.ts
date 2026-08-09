/**
 * iencLayers.ts — IENC GeoJSON overlay specs for MapLibre.
 *
 * Defines four GeoJSON sources and their corresponding display layers for the
 * two pilot IENC cells (1R76W8LI, 1R7788RI) published to
 * `public/nautical/` by the data pipeline.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  NOT IHO S-52 COMPLIANT — prototype portrayal only.                 │
 * │  Colours and symbol rules do not follow IHO Publication S-52.       │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── TOPMAR RENDERING DECISION (2026-08-09) ───────────────────────────
 * All 15 TOPMAR features carry associationRefsVerifiedInGdalOutput: false.
 * GDAL 3.2.2 S-57 driver did not expose FFPT parent-association records
 * (LNAM_REFS, FFPT_RIND) in the decoded GeoJSON output. Proximity analysis
 * shows 11/15 TOPMARs are co-located (dist=0) with parent buoys/beacons,
 * but 4/15 are spatially detached. Because the formal S-57 association chain
 * cannot be verified from the decoded data, standalone TOPMAR rendering is
 * DEFERRED per the decision rule in the Task #8 brief.
 *
 * Implementation: the nav-marks layer applies a MapLibre filter that
 * excludes dolphinKind === "topmark". TOPMARs remain in the GeoJSON
 * file and pass validation — only map display is suppressed.
 *
 * This decision is documented in nautical-investigation/ACCEPTANCE-TEST.md.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { OverlaySpec } from '../map/overlayManager';

/** Layer/source IDs used by IENC overlays — exported for click wiring. */
export const IENC_LAYER_IDS = {
  navMarksPoint: 'ienc-nav-marks-point',
  depthAreasFill: 'ienc-depth-areas-fill',
  depthContoursLine: 'ienc-depth-contours-line',
  soundingsPoint: 'ienc-soundings-point',
  soundingsLabel: 'ienc-soundings-label',
} as const;

export type IencLayerId = (typeof IENC_LAYER_IDS)[keyof typeof IENC_LAYER_IDS];

/**
 * MapLibre layer IDs that respond to tap/click for feature inspection.
 * TOPMAR excluded (deferred rendering). Soundings label layer excluded
 * (the point layer captures the tap area).
 */
export const IENC_CLICKABLE_LAYER_IDS: string[] = [
  IENC_LAYER_IDS.navMarksPoint,
  IENC_LAYER_IDS.depthAreasFill,
  IENC_LAYER_IDS.depthContoursLine,
  IENC_LAYER_IDS.soundingsPoint,
];

/**
 * Returns IENC OverlaySpec array, resolving source data URLs against baseUrl.
 * Must be called with import.meta.env.BASE_URL so paths work in both dev and prod.
 *
 * Sources are registered idempotently by applyOverlays — safe to call multiple times.
 */
export function getIencOverlaySpecs(baseUrl: string): OverlaySpec[] {
  const b = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return [
    // ── Navigation marks ─────────────────────────────────────────────
    // BCNSPP, BOYLAT, BOYSPP, LIGHTS — TOPMAR excluded (deferred rendering; see header).
    {
      sourceId: 'ienc-nav-marks-source',
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/navigation-marks.geojson`,
      },
      layerId: IENC_LAYER_IDS.navMarksPoint,
      layer: {
        id: IENC_LAYER_IDS.navMarksPoint,
        type: 'circle' as const,
        source: 'ienc-nav-marks-source',
        minzoom: 8,
        // Exclude TOPMARs — deferred rendering; see header comment.
        filter: ['!=', ['get', 'dolphinKind'], 'topmark'],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            8, 4,
            12, 7,
            16, 10,
          ],
          'circle-color': [
            'match', ['get', 'dolphinKind'],
            'buoy-lateral', '#e8a040',
            'buoy-special', '#e8e040',
            'beacon-special', '#e0c840',
            'light', '#44e4c2',
            /* default */ '#aaaaaa',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      },
      groupId: 'nav-marks',
    },

    // ── Depth areas (DEPARE) ─────────────────────────────────────────
    // Colored by DRVAL2 (upper depth bound). Negative = below datum.
    {
      sourceId: 'ienc-depth-areas-source',
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/depth-areas.geojson`,
      },
      layerId: IENC_LAYER_IDS.depthAreasFill,
      layer: {
        id: IENC_LAYER_IDS.depthAreasFill,
        type: 'fill' as const,
        source: 'ienc-depth-areas-source',
        minzoom: 8,
        paint: {
          // Depth colour ramp (DRVAL2: more-negative = deeper).
          // Prototype portrayal — not IHO S-52 compliant.
          'fill-color': [
            'step', ['to-number', ['get', 'DRVAL2'], 0],
            '#103a5a', // < −10 m: deep
            -10, '#1d6a96', // −10 … −2 m
            -2, '#5aaed6',  // −2 … 0 m: shallow
            0,  '#7bbf7b',  // ≥ 0 m: drying (above chart datum)
          ],
          'fill-opacity': 0.22,
        },
      },
      groupId: 'charted-depths',
    },

    // ── Depth contours (DEPCNT) ──────────────────────────────────────
    {
      sourceId: 'ienc-depth-contours-source',
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/depth-contours.geojson`,
      },
      layerId: IENC_LAYER_IDS.depthContoursLine,
      layer: {
        id: IENC_LAYER_IDS.depthContoursLine,
        type: 'line' as const,
        source: 'ienc-depth-contours-source',
        minzoom: 9,
        layout: {
          'line-join': 'round' as const,
          'line-cap': 'round' as const,
        },
        paint: {
          'line-color': '#3a93c4',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            9, 0.5,
            14, 1.2,
          ],
          'line-opacity': 0.6,
        },
      },
      groupId: 'charted-depths',
    },

    // ── Soundings (SOUNDG — individual Point features) ───────────────
    // Coloured by chartedValueRelationToDatum.
    {
      sourceId: 'ienc-soundings-source',
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/soundings.geojson`,
      },
      layerId: IENC_LAYER_IDS.soundingsPoint,
      layer: {
        id: IENC_LAYER_IDS.soundingsPoint,
        type: 'circle' as const,
        source: 'ienc-soundings-source',
        minzoom: 10,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 2.5,
            14, 4.5,
          ],
          'circle-color': [
            'match', ['get', 'chartedValueRelationToDatum'],
            'below', '#44b4d4',  // submerged — blue
            'above', '#f5a623',  // drying height — amber
            'at',    '#9b59b6',  // at datum — purple
            /* default */ '#888888',
          ],
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 0.8,
        },
      },
      groupId: 'charted-depths',
    },

    // ── Sounding depth labels (high zoom only) ───────────────────────
    // Shows |chartedValueMetres| as a text label; shares the soundings source.
    {
      sourceId: 'ienc-soundings-source', // reuses the same registered source
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/soundings.geojson`, // applyOverlays guards against dup source
      },
      layerId: IENC_LAYER_IDS.soundingsLabel,
      layer: {
        id: IENC_LAYER_IDS.soundingsLabel,
        type: 'symbol' as const,
        source: 'ienc-soundings-source',
        minzoom: 13,
        layout: {
          'text-field': ['to-string', ['abs', ['to-number', ['get', 'chartedValueMetres'], 0]]],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top' as const,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#071820',
          'text-halo-width': 1,
        },
      },
      groupId: 'charted-depths',
    },
  ];
}
