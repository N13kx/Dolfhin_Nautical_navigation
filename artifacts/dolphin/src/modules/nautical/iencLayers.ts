/**
 * iencLayers.ts — IENC GeoJSON overlay specs for MapLibre.
 *
 * Defines four stable GeoJSON sources and their corresponding display layers.
 * The viewport controller fills these sources from validated per-cell files
 * referenced by `public/nautical/catalog.json`.
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
 * ── NAVIGATION MARK PORTRAYAL (DOL-011b, 2026-08-10) ────────────────
 * Verified source attributes (DOL-011b data check on pilot cells):
 *
 *   buoy-lateral  (12): CATLAM=2/3/4, BOYSHP=5 (pillar), OBJNAM present
 *   buoy-special   (5): COLOUR=["6"] (yellow), BOYSHP=5 (pillar), OBJNAM present
 *   beacon-special (2): COLOUR=["2"] (black), BCNSHP=1 (stake), no OBJNAM
 *
 * Symbol strategy — no external icons; MapLibre-native layers only:
 *
 *   buoy-lateral / buoy-special (BOYSHP=5, pillar):
 *     Outer coloured ring (navMarksPoint, larger radius) + white inner dot
 *     (navMarksInner). The ring-with-centre represents the circular top of a
 *     pillar buoy viewed from above, distinguishing floating marks from
 *     fixed structures. No shape beyond BOYSHP=5 is inferred.
 *
 *   beacon-special (BCNSHP=1, stake):
 *     Small solid dark-slate dot (navMarksPoint, smaller radius) + '+' cross
 *     character above it (navMarksBeaconStake) suggesting a vertical post.
 *     BCNSHP=1 is the sole verified shape attribute; no other stake-top
 *     decoration is implied.
 *
 *   light (LIGHTS):
 *     Warm halo ring (navMarksHalo) behind a small COLOUR-coded dot.
 *     Unchanged from DOL-011.
 *
 * Colour sources:
 *   CATLAM — lateral category for buoy-lateral:
 *     2=port-hand→red, 3=starboard-hand→green, 4=preferred-channel→violet.
 *     Source: verified S-57 CATLAM attribute (Rijkswaterstaat IENC).
 *   COLOUR[0] — primary light colour for LIGHTS:
 *     "1"=white, "3"=red, "4"=green, "6"=yellow.
 *   buoy-special: always yellow (COLOUR=["6"] on all 5 features).
 *   beacon-special: dark slate (COLOUR=["2"] / black, on both features).
 *
 *   OBJNAM — mark name string (e.g. "NV 8", "SM-16"). Absent on
 *     beacon-special; label layer filters to present-and-non-empty only.
 *
 * Attributes deliberately NOT interpreted:
 *   LITCHR, SIGPER, SIGGRP — light characteristics deferred.
 *   COLPAT — colour pattern; only primary COLOUR[0] is accessed.
 *   CATSPM — special purpose category; buoy-special shown as neutral yellow.
 *   BOYSHP values other than 5 — only pillar (5) occurs in pilot data.
 *   BCNSHP values other than 1 — only stake (1) occurs in pilot data.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { OverlaySpec } from '../map/overlayManager';
import { EMPTY_FEATURE_COLLECTION } from './catalogLoader';

/** Layer/source IDs used by IENC overlays — exported for click wiring. */
export const IENC_LAYER_IDS = {
  navMarksHalo:         'ienc-nav-marks-halo',         // lights-only outer glow ring (visual only)
  navMarksPoint:        'ienc-nav-marks-point',        // outer coloured ring (buoys) / solid dot (beacon, light) + click target
  navMarksInner:        'ienc-nav-marks-inner',        // white centre dot for pillar buoys only (ring-body appearance)
  navMarksBeaconStake:  'ienc-nav-marks-beacon-stake', // '+' stake character above beacon-special dots
  navMarksLabel:        'ienc-nav-marks-label',        // OBJNAM text labels
  depthAreasFill:       'ienc-depth-areas-fill',
  depthContoursLine:    'ienc-depth-contours-line',
  soundingsPoint:       'ienc-soundings-point',        // transparent tap/click hit target
  soundingsLabel:       'ienc-soundings-label',        // progressive charted-depth text
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
 * Returns IENC OverlaySpec array. Sources start empty and are populated by the
 * catalog-backed viewport controller after the MapLibre style is ready.
 *
 * Sources are registered idempotently by applyOverlays — safe to call multiple times.
 */
export type IencRuntimeSource = 'catalog' | 'pmtiles';

export const IENC_RUNTIME_SOURCE: IencRuntimeSource =
  import.meta.env.VITE_IENC_SOURCE === 'pmtiles' ? 'pmtiles' : 'catalog';

const PMTILES_SOURCE_ID = 'ienc-pmtiles-source';
const SOURCE_LAYER_BY_GEOJSON_SOURCE: Record<string, string> = {
  'ienc-nav-marks-source': 'navigation-marks',
  'ienc-depth-areas-source': 'depth-areas',
  'ienc-depth-contours-source': 'depth-contours',
  'ienc-soundings-source': 'soundings',
};

// ── DOL-017 diagnostic: A/B layer isolation ──────────────────────────────
// VITE_IENC_DIAGNOSTIC_LAYERS restricts which PMTiles source layers are
// rendered, without altering source data.
//
// Accepted values (comma-separated): marks, areas, contours, soundings
// Examples:
//   VITE_IENC_DIAGNOSTIC_LAYERS=marks            → A: nav-marks only
//   VITE_IENC_DIAGNOSTIC_LAYERS=marks,areas      → B: marks + depth-areas
//   VITE_IENC_DIAGNOSTIC_LAYERS=marks,areas,contours → C: + depth-contours
//   (unset)                                      → D: all four layers
//
// Has no effect in catalog mode. Temporary diagnostic only.
const _diagEnv = import.meta.env.VITE_IENC_DIAGNOSTIC_LAYERS as string | undefined;
const _diagAliases: Record<string, string> = {
  marks: 'navigation-marks',
  areas: 'depth-areas',
  contours: 'depth-contours',
  soundings: 'soundings',
};
const DIAG_ACTIVE_SOURCE_LAYERS: Set<string> | null = _diagEnv
  ? new Set(_diagEnv.split(',').map((s) => _diagAliases[s.trim()] ?? s.trim()).filter(Boolean))
  : null;

/** Active diagnostic source layers for external inspection (e.g. MapView). */
export const IENC_DIAG_ACTIVE_LAYERS: Set<string> | null = DIAG_ACTIVE_SOURCE_LAYERS;

export function getIencOverlaySpecs(baseUrl: string): OverlaySpec[] {
  const specs: OverlaySpec[] = [
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
        data: EMPTY_FEATURE_COLLECTION,
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

    // ── Navigation marks — outer ring / main dot ────────────────────
    //
    // For BOYLAT and BOYSPP (pillar buoys): acts as the outer coloured ring.
    // A separate white inner dot layer (navMarksInner) sits on top, producing
    // a ring-with-centre that suggests the circular top of a pillar buoy.
    // For BCNSPP (stake beacon): a smaller solid dot. A cross-character layer
    // (navMarksBeaconStake) above it suggests a vertical post.
    // For LIGHTS: unchanged small COLOUR-coded dot behind the halo.
    // TOPMAR excluded (deferred; see header comment).
    //
    // Radius is type-aware:
    //   buoy-lateral / buoy-special: zoom 8→6 | zoom 12→10 | zoom 16→14 px
    //   beacon-special:              zoom 8→3 | zoom 12→ 5 | zoom 16→ 7 px
    //   light:                       zoom 8→4 | zoom 12→ 7 | zoom 16→10 px
    //
    // Colour assignment:
    //   buoy-lateral: CATLAM 2=red(#cc3333), 3=green(#339944), 4=violet(#9933aa), other=amber(#e07820)
    //   buoy-special: yellow #e8e040 (all 5 features have COLOUR=["6"])
    //   beacon-special: dark slate #445566 (both features have COLOUR=["2"])
    //   light: COLOUR[0] "1"=cream/#f4f4e8, "3"=red/#ee4444, "4"=green/#44cc44, "6"=yellow/#ffdd44, other=teal/#44cccc
    {
      sourceId: 'ienc-nav-marks-source', // source already registered above
      source: {
        type: 'geojson' as const,
        data: EMPTY_FEATURE_COLLECTION,
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
          // Type-aware radius: buoys are larger (pillar ring), beacons smaller (stake dot).
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            8,  ['match', ['get', 'dolphinKind'], ['buoy-lateral', 'buoy-special'],  6, 'beacon-special', 3, 4],
            12, ['match', ['get', 'dolphinKind'], ['buoy-lateral', 'buoy-special'], 10, 'beacon-special', 5, 7],
            16, ['match', ['get', 'dolphinKind'], ['buoy-lateral', 'buoy-special'], 14, 'beacon-special', 7, 10],
          ],
          'circle-color': [
            'case',

            // ── Lateral buoys: CATLAM-based colour ────────────────
            ['==', ['get', 'dolphinKind'], 'buoy-lateral'],
            [
              'match',
              // CATLAM is a numeric S-57 attribute stored in sourceProperties.
              // Convert to string for match expression compatibility.
              ['to-string', ['coalesce', ['get', 'CATLAM'], ['get', 'CATLAM', ['get', 'sourceProperties']]]],
              '2', '#cc3333',  // port-hand
              '3', '#339944',  // starboard-hand
              '4', '#9933aa',  // preferred-channel
              '#e07820',       // unknown / absent CATLAM
            ],

            // ── Special buoys: yellow ──────────────────────────────
            // COLOUR=["6"] verified on all 5 buoy-special features.
            ['==', ['get', 'dolphinKind'], 'buoy-special'],
            '#e8e040',

            // ── Special beacons: dark slate ────────────────────────
            // COLOUR=["2"] (black) verified on both beacon-special features.
            ['==', ['get', 'dolphinKind'], 'beacon-special'],
            '#445566',

            // ── Lights: primary COLOUR[0] code ─────────────────────
            ['==', ['get', 'dolphinKind'], 'light'],
            [
              'match',
              // COLOUR is stored as an array of string-encoded S-57 codes.
              // ['at', 0, ...] retrieves the primary (first) colour element.
              ['coalesce',
                ['get', 'COLOURPrimary'],
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

    // ── Navigation marks — white inner dot (pillar buoys only) ──────
    //
    // Stacked above navMarksPoint for buoy-lateral and buoy-special only.
    // Together with the outer coloured ring they form a ring-with-centre that
    // visually suggests the circular top of a pillar buoy (BOYSHP=5).
    // beacon-special and light features are excluded — they use solid dots.
    {
      sourceId: 'ienc-nav-marks-source',
      source: {
        type: 'geojson' as const,
        data: EMPTY_FEATURE_COLLECTION,
      },
      layerId: IENC_LAYER_IDS.navMarksInner,
      layer: {
        id: IENC_LAYER_IDS.navMarksInner,
        type: 'circle' as const,
        source: 'ienc-nav-marks-source',
        minzoom: 8,
        filter: ['match', ['get', 'dolphinKind'], ['buoy-lateral', 'buoy-special'], true, false],
        paint: {
          // Inner dot: ~35–40% of the outer radius at each zoom stop.
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            8,  2.0,
            12, 3.5,
            16, 5.0,
          ],
          'circle-color': '#ffffff',
          'circle-opacity': 0.88,
          'circle-stroke-width': 0,
        },
      },
      groupId: 'nav-marks',
    },

    // ── Navigation marks — beacon stake character ────────────────────
    //
    // Renders a '+' cross above the beacon-special dot to suggest a vertical
    // stake/post form (BCNSHP=1). No external icons required.
    // text-allow-overlap and text-ignore-placement are both true so that the
    // stake character always renders over its own dot regardless of label
    // collision state from other layers.
    {
      sourceId: 'ienc-nav-marks-source',
      source: {
        type: 'geojson' as const,
        data: EMPTY_FEATURE_COLLECTION,
      },
      layerId: IENC_LAYER_IDS.navMarksBeaconStake,
      layer: {
        id: IENC_LAYER_IDS.navMarksBeaconStake,
        type: 'symbol' as const,
        source: 'ienc-nav-marks-source',
        minzoom: 9,
        filter: ['==', ['get', 'dolphinKind'], 'beacon-special'],
        layout: {
          // '+' cross character suggests the stake-top form of BCNSHP=1.
          // Not a label — no OBJNAM; purely a visual shape substitute.
          'text-field': '+',
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            9,  10,
            12, 13,
            16, 16,
          ],
          'text-anchor': 'bottom' as const,
          'text-offset': [0, 0.1], // place just above the dot centroid
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#cce0ee',
          'text-halo-color': '#0a1020',
          'text-halo-width': 1.0,
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
        data: EMPTY_FEATURE_COLLECTION,
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
            ['coalesce', ['get', 'OBJNAM'], ['get', 'OBJNAM', ['get', 'sourceProperties']], ''],
            '',
          ],
        ],
        layout: {
          'text-field': [
            'coalesce',
            ['coalesce', ['get', 'OBJNAM'], ['get', 'OBJNAM', ['get', 'sourceProperties']]],
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
        data: EMPTY_FEATURE_COLLECTION,
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
        data: EMPTY_FEATURE_COLLECTION,
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
        data: EMPTY_FEATURE_COLLECTION,
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
        data: EMPTY_FEATURE_COLLECTION, // applyOverlays guards against dup source
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

  if (IENC_RUNTIME_SOURCE === 'catalog') return specs;

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  // DOL-017: filter to only the requested source layers (A/B isolation).
  // Specs whose GeoJSON sourceId maps to an excluded layer are dropped entirely.
  const activeSpecs = DIAG_ACTIVE_SOURCE_LAYERS
    ? specs.filter((spec) => {
        const sl = SOURCE_LAYER_BY_GEOJSON_SOURCE[spec.sourceId];
        // Specs not in the IENC source map (e.g. future additions) pass through.
        return !sl || DIAG_ACTIVE_SOURCE_LAYERS.has(sl);
      })
    : specs;

  return activeSpecs.map((spec) => {
    const sourceLayer = SOURCE_LAYER_BY_GEOJSON_SOURCE[spec.sourceId];
    if (!sourceLayer) return spec;
    return {
      ...spec,
      sourceId: PMTILES_SOURCE_ID,
      source: {
        type: 'vector' as const,
        url: `pmtiles://${base}nautical/dolphin-zeeland.pmtiles`,
        attribution: 'Official IENC source: Rijkswaterstaat; Dolphin experimental portrayal; not for navigation',
      },
      layer: {
        ...spec.layer,
        source: PMTILES_SOURCE_ID,
        'source-layer': sourceLayer,
      } as typeof spec.layer,
    };
  });
}
