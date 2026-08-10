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

    // ── Soundings — transparent hit-target circle (SOUNDG) ───────────
    //
    // PURPOSE: interaction only, not visual portrayal.
    // The colored dot portrayal has been replaced by progressive depth labels
    // (see ienc-soundings-label below). This circle layer remains at opacity 0
    // so that NauticalObjectSheet tap interaction continues to work via
    // queryRenderedFeatures — MapLibre hit-tests transparent circles at their
    // full paint radius even when opacity is 0.
    //
    // All three relations (below / above / at) are kept in the hit-target
    // so that tapping any sounding opens the detail sheet.
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
          // Generous hit radius at all zoom levels; fully transparent.
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 8,
            16, 12,
          ],
          'circle-opacity': 0,
          'circle-stroke-width': 0,
        },
      },
      groupId: 'charted-depths',
    },

    // ── Soundings — progressive charted-depth text labels ────────────
    //
    // DISPLAY MODEL:
    //   Only relation === "below" features are portrayed as depth labels.
    //   chartedValueMetres is negative for below-datum soundings (e.g. -2.9).
    //   The label shows the positive magnitude: abs(chartedValueMetres) → "2.9".
    //   The stored signed value is never mutated.
    //
    //   relation === "above" (drying heights) and "at" are NOT shown as depth
    //   labels. They remain in the data and are accessible via tap → sheet.
    //   They must never be implied to be navigable or safe depth.
    //
    // PROGRESSIVE DENSITY (zoom thresholds, documented):
    //   zoom 10 — minzoom start; text-size 9px; MapLibre collision keeps only
    //             well-separated labels → very sparse, representative soundings
    //   zoom 12 — text-size 10px; more labels fit without colliding
    //   zoom 14 — text-size 11px; dense — normal boating zoom
    //   zoom 16 — text-size 12px; high-detail close zoom
    //
    // MapLibre symbol collision (text-allow-overlap: false) is the primary
    // density control. Smaller text at low zoom means fewer labels fit in the
    // viewport without overlapping — no random sampling, deterministic output.
    // The same viewport + zoom always produces the same label set.
    {
      sourceId: 'ienc-soundings-source', // source already registered above
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/soundings.geojson`, // applyOverlays guards against dup source
      },
      layerId: IENC_LAYER_IDS.soundingsLabel,
      layer: {
        id: IENC_LAYER_IDS.soundingsLabel,
        type: 'symbol' as const,
        source: 'ienc-soundings-source',
        minzoom: 10,
        // Only below-datum soundings are displayed as charted-depth labels.
        // above (drying height) and at are excluded from label portrayal.
        filter: ['==', ['get', 'chartedValueRelationToDatum'], 'below'],
        layout: {
          // Display positive magnitude of the stored signed value.
          // chartedValueMetres is negative for below-datum (e.g. -2.9 → "2.9").
          // abs() is applied here in the display formatter only — stored data unchanged.
          'text-field': [
            'to-string',
            ['abs', ['to-number', ['get', 'chartedValueMetres'], 0]],
          ],
          // Progressive text size drives collision-based density.
          // Smaller text → fewer labels fit without overlapping → sparser at low zoom.
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            10, 9,
            12, 10,
            14, 11,
            16, 12,
          ],
          'text-anchor': 'center' as const,
          // Collision off: MapLibre places as many non-overlapping labels as possible.
          // This is deterministic — same viewport + zoom → same label set.
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          // Allow label to be skipped if it would overlap (rather than force-placing).
          'text-optional': true,
        },
        paint: {
          'text-color': '#c8e8f8',
          'text-halo-color': '#071820',
          'text-halo-width': 1.2,
        },
      },
      groupId: 'charted-depths',
    },
  ];
}
