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
 * Implementation: the nav-marks layers apply a MapLibre filter that
 * excludes dolphinKind === "topmark". TOPMARs remain in the GeoJSON
 * file and pass validation — only map display is suppressed.
 *
 * This decision is documented in nautical-investigation/ACCEPTANCE-TEST.md.
 * ─────────────────────────────────────────────────────────────────────
 *
 * ── SOUNDING LABEL DENSITY STRATEGY (DOL-011, 2026-08-10) ───────────
 * Progressive density is driven by text-padding interpolation across zoom.
 * Higher text-padding at low zoom creates a larger exclusion zone around
 * each placed symbol, allowing MapLibre's collision engine to admit far
 * fewer labels. As zoom increases, text-padding shrinks and more labels
 * fit without colliding.
 *
 * Only chartedValueRelationToDatum === "below" features are labeled.
 * "above" (drying heights) and "at" features are never shown as depth labels.
 *
 * symbol-sort-key ascending by |depth|: shallower soundings sort earlier and
 * win collision priority at sparse zoom levels — prioritising safety-critical
 * shallow depth information over deeper soundings.
 *
 * Zoom thresholds and density targets (468 eligible below-datum soundings):
 *   zoom 10 — text-padding 80, text-size  9 →  sparse   (~7–15% visible)
 *   zoom 12 — text-padding 30, text-size 10 →  moderate (~20–35% visible)
 *   zoom 14 — text-padding  8, text-size 11 →  dense    (~55–75% visible)
 *   zoom 16 — text-padding  2, text-size 12 →  near-full (~85–95% visible)
 *
 * Actual visible fraction varies with viewport size and local cluster density.
 * Results are deterministic: same viewport + zoom → same label set.
 * ─────────────────────────────────────────────────────────────────────
 *
 * ── NAVIGATION MARK PORTRAYAL (DOL-011, 2026-08-10) ─────────────────
 * Properties accessed from sourceProperties (real nested object in GeoJSON,
 * accessible via MapLibre ['get', 'key', ['get', 'sourceProperties']]):
 *
 *   CATLAM — lateral category for BOYLAT features:
 *     2 = port-hand, 3 = starboard-hand, 4 = preferred-channel-to-port
 *     Source: verified S-57 CATLAM attribute from Rijkswaterstaat IENC.
 *     Used to colour-code lateral buoys without inventing spatial inference.
 *
 *   COLOUR — primary light colour code (array, first element used):
 *     "1"=white, "3"=red, "4"=green, "6"=yellow.
 *     Source: verified S-57 COLOUR attribute from Rijkswaterstaat IENC.
 *     Used to represent the emitted light colour on the map dot.
 *
 *   OBJNAM — mark name string (e.g. "NV 8", "SM-16").
 *     Source: verified S-57 OBJNAM attribute. Absent on some features;
 *     label layer filters to present-and-non-empty only.
 *
 * Attributes deliberately NOT interpreted:
 *   LITCHR, SIGPER, SIGGRP — light characteristics. Present on LIGHTS but
 *     not visualised to avoid implying specific temporal patterns.
 *   BCNSHP, BOYSHP — physical shape codes. Not used; shape portrayal via
 *     distinct layer instead of per-feature geometry.
 *   COLPAT — colour pattern. Not used; only primary COLOUR[0] is accessed.
 *   CATSPM — special purpose category. Not used; buoy-special shown neutral.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { OverlaySpec } from '../map/overlayManager';

/** Layer/source IDs used by IENC overlays — exported for click wiring. */
export const IENC_LAYER_IDS = {
  navMarksHalo:    'ienc-nav-marks-halo',    // lights-only outer glow ring (visual only)
  navMarksPoint:   'ienc-nav-marks-point',   // main mark circle + hit target
  navMarksLabel:   'ienc-nav-marks-label',   // OBJNAM text labels
  depthAreasFill:  'ienc-depth-areas-fill',
  depthContoursLine: 'ienc-depth-contours-line',
  soundingsPoint:  'ienc-soundings-point',   // transparent tap/click hit target
  soundingsLabel:  'ienc-soundings-label',   // progressive charted-depth text
} as const;

export type IencLayerId = (typeof IENC_LAYER_IDS)[keyof typeof IENC_LAYER_IDS];

/**
 * MapLibre layer IDs that respond to tap/click for feature inspection.
 * TOPMAR excluded (deferred rendering).
 * navMarksHalo and navMarksLabel excluded (navMarksPoint captures tap area).
 * soundingsLabel excluded (soundingsPoint captures tap area).
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
    // ── Navigation marks — light glow halo ──────────────────────────
    //
    // Rendered behind the main mark circle. Applies only to LIGHTS features.
    // The soft translucent ring suggests the visual spread of a light source
    // without implying any specific light characteristic.
    // Verified attribute used: dolphinKind === 'light' (derived from OBJL=75, LIGHTS).
    {
      sourceId: 'ienc-nav-marks-source',
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/navigation-marks.geojson`,
      },
      layerId: IENC_LAYER_IDS.navMarksHalo,
      layer: {
        id: IENC_LAYER_IDS.navMarksHalo,
        type: 'circle' as const,
        source: 'ienc-nav-marks-source',
        minzoom: 9,
        filter: ['==', ['get', 'dolphinKind'], 'light'],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9,  12,
            12, 18,
            16, 26,
          ],
          // Warm cream glow — not keyed to any colour attribute.
          // COLOUR-based light colours appear on the smaller inner circle.
          'circle-color': '#fffbe0',
          'circle-opacity': 0.18,
          'circle-stroke-width': 0,
        },
      },
      groupId: 'nav-marks',
    },

    // ── Navigation marks — main circle ──────────────────────────────
    //
    // BCNSPP, BOYLAT, BOYSPP, LIGHTS — TOPMAR excluded (deferred; see header).
    //
    // Colour assignment:
    //
    //   buoy-lateral (BOYLAT):
    //     Keyed to verified CATLAM attribute (S-57 lateral category code):
    //       CATLAM=2  port-hand           → red   (#cc3333)
    //       CATLAM=3  starboard-hand      → green (#339944)
    //       CATLAM=4  preferred-channel   → violet (#9933aa)
    //       other/absent                  → amber  (#e07820)
    //     CATLAM is an official Rijkswaterstaat attribute. Its use here
    //     reflects the marked lateral category, not an invented colour rule.
    //     No claim of IHO S-52 colour compliance is made.
    //
    //   buoy-special (BOYSPP):
    //     Neutral yellow — all 5 BOYSPP features have COLOUR=6 (yellow)
    //     in the source data. Yellow is the internationally standard
    //     colour for special-purpose marks.
    //
    //   beacon-special (BCNSPP):
    //     Dark slate — both BCNSPP features have COLOUR=2 (black) in
    //     the source data.
    //
    //   light (LIGHTS):
    //     Keyed to verified COLOUR attribute (primary element COLOUR[0]):
    //       "1" white  → pale cream (#f4f4e8)
    //       "3" red    → red       (#ee4444)
    //       "4" green  → green     (#44cc44)
    //       "6" yellow → yellow    (#ffdd44)
    //       other      → teal      (#44cccc)
    //     COLOUR[0] is the S-57 primary colour code. The map colour
    //     represents the physical light colour, not a characteristic pattern.
    {
      sourceId: 'ienc-nav-marks-source', // source already registered above
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
            'case',

            // ── Lateral buoys: CATLAM-based colour ────────────────
            ['==', ['get', 'dolphinKind'], 'buoy-lateral'],
            [
              'match',
              // CATLAM is a numeric S-57 attribute stored in sourceProperties.
              // Convert to string for match expression compatibility.
              ['to-string', ['get', 'CATLAM', ['get', 'sourceProperties']]],
              '2', '#cc3333',  // port-hand
              '3', '#339944',  // starboard-hand
              '4', '#9933aa',  // preferred-channel
              '#e07820',       // unknown / absent CATLAM
            ],

            // ── Special buoys: yellow ──────────────────────────────
            ['==', ['get', 'dolphinKind'], 'buoy-special'],
            '#e8e040',

            // ── Special beacons: dark slate ────────────────────────
            ['==', ['get', 'dolphinKind'], 'beacon-special'],
            '#445566',

            // ── Lights: primary COLOUR[0] code ─────────────────────
            ['==', ['get', 'dolphinKind'], 'light'],
            [
              'match',
              // COLOUR is stored as an array of string-encoded S-57 codes.
              // ['at', 0, ...] retrieves the primary (first) colour element.
              ['coalesce',
                ['at', 0, ['get', 'COLOUR', ['get', 'sourceProperties']]],
                '1',
              ],
              '1', '#f4f4e8',  // white
              '3', '#ee4444',  // red
              '4', '#44cc44',  // green
              '6', '#ffdd44',  // yellow
              '#44cccc',       // other
            ],

            /* default — should not occur for non-TOPMAR features */
            '#aaaaaa',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      },
      groupId: 'nav-marks',
    },

    // ── Navigation marks — name labels ──────────────────────────────
    //
    // Shows the verified OBJNAM attribute (mark name, e.g. "NV 8", "SM-16")
    // for marks that carry it in the source data.
    //
    // Excluded: TOPMAR (deferred), LIGHTS (38 overlapping labels is too dense;
    // light characteristics are not rendered in this task).
    // Excluded: features where OBJNAM is absent or empty in sourceProperties.
    //
    // Verified attribute used: OBJNAM from sourceProperties.
    {
      sourceId: 'ienc-nav-marks-source', // source already registered above
      source: {
        type: 'geojson' as const,
        data: `${b}nautical/navigation-marks.geojson`,
      },
      layerId: IENC_LAYER_IDS.navMarksLabel,
      layer: {
        id: IENC_LAYER_IDS.navMarksLabel,
        type: 'symbol' as const,
        source: 'ienc-nav-marks-source',
        minzoom: 11,
        filter: [
          'all',
          ['!=', ['get', 'dolphinKind'], 'topmark'],
          ['!=', ['get', 'dolphinKind'], 'light'],
          // Only show label when OBJNAM is present and non-empty.
          [
            '!=',
            ['coalesce', ['get', 'OBJNAM', ['get', 'sourceProperties']], ''],
            '',
          ],
        ],
        layout: {
          'text-field': [
            'coalesce',
            ['get', 'OBJNAM', ['get', 'sourceProperties']],
            '',
          ],
          'text-size': 10,
          'text-anchor': 'top' as const,
          'text-offset': [0, 0.9],
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#e8f4ff',
          'text-halo-color': '#0a1020',
          'text-halo-width': 1.2,
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
    //   chartedValueMetres is POSITIVE for below-datum soundings (e.g. +2.9).
    //   S-57 contract: Z > 0 = charted depth below datum. Positive Z is stored
    //   as-is. abs() in the text-field expression is defensive and no-op for
    //   well-formed below-datum data. Stored signed value is never mutated.
    //   No "*" suffix.
    //
    //   relation === "above" (drying heights) and "at" are NOT shown as depth
    //   labels. They remain in the data and are accessible via tap → sheet.
    //   They must never be implied to be navigable or safe depth.
    //
    // PROGRESSIVE DENSITY — text-padding interpolation (deterministic):
    //
    //   text-padding defines the minimum pixel clearance between any two
    //   placed symbols. MapLibre's collision engine rejects any symbol that
    //   would land within this exclusion zone of an already-placed one.
    //   Increasing text-padding at lower zoom creates a larger exclusion zone
    //   so far fewer labels are admitted — no random sampling, fully
    //   deterministic (same viewport + zoom → same label set every time).
    //   As the user zooms in, text-padding shrinks and progressively more
    //   labels clear the collision check and appear.
    //
    //   symbol-sort-key ascending by |chartedValueMetres|:
    //   Shallower soundings (smaller absolute value) sort first and win
    //   collision priority at sparse zoom levels. This ensures safety-critical
    //   shallow depth information appears before deeper soundings.
    //
    // Zoom thresholds and density targets (468 eligible below-datum soundings):
    //   zoom 10 — padding 80px, size  9px →  sparse    (~7–15% visible)
    //   zoom 12 — padding 30px, size 10px →  moderate  (~20–35% visible)
    //   zoom 14 — padding  8px, size 11px →  dense     (~55–75% visible)
    //   zoom 16 — padding  2px, size 12px →  near-full (~85–95% visible)
    //
    // text-size also increases with zoom (9→12px), which amplifies the density
    // effect: larger glyphs occupy more space and further reduce crowding at
    // lower zoom levels.
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
          // chartedValueMetres is positive for below-datum (e.g. +2.9 → "2.9").
          // abs() is defensive (no-op for well-formed data); stored value unchanged.
          'text-field': [
            'to-string',
            ['abs', ['to-number', ['get', 'chartedValueMetres'], 0]],
          ],
          // Progressive text size: amplifies the density effect by increasing
          // glyph footprint at lower zoom in addition to text-padding.
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            10,  9,
            12, 10,
            14, 11,
            16, 12,
          ],
          // PRIMARY density control: shrinking exclusion zone as zoom increases.
          'text-padding': [
            'interpolate', ['linear'], ['zoom'],
            10, 80,   // wide exclusion → very sparse
            12, 30,   // moderate exclusion
            14,  8,   // tight exclusion → dense
            16,  2,   // minimal exclusion → near-full
          ],
          'text-anchor': 'center' as const,
          // Collision: never force-place; a label is skipped rather than
          // overlapping an already-placed label or other symbol.
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          // Sort ascending by depth magnitude so shallower soundings (smallest
          // abs value) win collision priority at sparse zoom levels.
          // Safety rationale: shallow depth is the critical hazard information.
          'symbol-sort-key': ['abs', ['to-number', ['get', 'chartedValueMetres'], 0]],
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
