---
name: Dolphin Architecture
description: Module layout, key fixes, UX patterns, and IENC layer implementation decisions for the Dolphin navigation app.
---

# Dolphin Architecture

## Module layout
- `artifacts/dolphin/src/` — main frontend
  - `pages/DolphinApp.tsx` — root state: mapMode, layerGroupVisibility, selectedFeature, manifest
  - `components/MapView.tsx` — props: layerGroupVisibility, onFeatureClick; applies group visibility after every overlay apply; global click handler queries IENC clickable layers
  - `components/LayerSheet.tsx` — layer toggle section; Dolphin shows nav-marks + charted-depths; Hybrid adds community-seamarks; Satellite shows none
  - `components/NauticalObjectSheet.tsx` — bottom sheet for tapped IENC features; signed sounding display model
  - `modules/map/overlayManager.ts` — OverlaySpec gains groupId?; applyLayerGroupVisibility(); OpenSeaMap gets groupId: 'community-seamarks' (default OFF)
  - `modules/nautical/iencLayers.ts` — all IENC layer specs (see below)
  - `modules/nautical/manifestLoader.ts` — typed manifest loader, getCellMeta(cellId), aborts if status ≠ PASS

## Critical fixes to preserve

### Satellite ↔ Hybrid: NO setStyle
Same ESRI base. Switching between Satellite and Hybrid MUST NOT call setStyle.
Overlays reconciled via removeOverlays/applyOverlays only.
Regression: zero-diff lifecycle bug (map goes blank).

### GPS stale detection
Uses timestamp delta; no special MapLibre hooks needed.

### Tracking snap-back
Implemented in DolphinApp; do not break follow-mode state on re-renders.

## IENC layer structure (iencLayers.ts) — as of DOL-011

Layer IDs:
- `ienc-nav-marks-halo` — lights-only glow ring (visual, not clickable)
- `ienc-nav-marks-point` — main circle, tap target (clickable)
- `ienc-nav-marks-label` — OBJNAM text, buoys/beacons only, minzoom 11 (not clickable)
- `ienc-depth-areas-fill` — DEPARE fill (clickable)
- `ienc-depth-contours-line` — DEPCNT line (clickable)
- `ienc-soundings-point` — transparent hit target opacity=0 (clickable)
- `ienc-soundings-label` — progressive text labels, below-only

Only IENC_CLICKABLE_LAYER_IDS are wired to queryRenderedFeatures. Halo and label layers excluded.

## Nav-mark portrayal decisions (DOL-011)

sourceProperties is a REAL nested object in GeoJSON (not stringified).
Access via: `['get', 'KEY', ['get', 'sourceProperties']]`

buoy-lateral colour: CATLAM attribute (verified S-57):
  2=port→red, 3=starboard→green, 4=preferred→violet, unknown→amber.

light colour: COLOUR[0] attribute (verified S-57 string code):
  "1"=white, "3"=red, "4"=green, "6"=yellow, other→teal.

buoy-special: yellow (all 5 have COLOUR=6).
beacon-special: dark slate (both have COLOUR=2).

Attributes deliberately NOT used: LITCHR, SIGPER, SIGGRP (deferred to follow-up),
BCNSHP, BOYSHP, COLPAT, CATSPM.

OBJNAM label: minzoom 11, buoys+beacons only (not lights — too dense).
Filter: non-empty coalesce guard (not `has` expr, for type safety).

## Sounding label density (DOL-011)

Primary control: text-padding interpolation (80→2px from zoom 10→16).
Secondary: text-size 9→12px.
symbol-sort-key ascending by abs(chartedValueMetres) → shallower wins collision.
Only `below` relation labeled. `above` (drying heights) and `at` never labeled.
Targets: ~7-15% z10 / ~20-35% z12 / ~55-75% z14 / ~85-95% z16.

## TOPMAR decision
Deferred. 15/15 have associationRefsVerifiedInGdalOutput:false.
4/15 spatially detached. Excluded via filter. Documented in ACCEPTANCE-TEST.md.
Tracked in existing task "Enable topmark rendering once chart association records are verified".

## Data invariants
- Two cells only: 1R76W8LI (ed.78), 1R7788RI (ed.46). Both Rijkswaterstaat.
- pipelineFeatureId format: `cellId/OBJCLASS/RCID/index` for soundings.
- chartedValueMetres: signed (negative=below datum). Never mutate. Display abs() for labels.
- depthDatum: "Approximate LAT" (SDAT=42, VERIFIED).
- verticalDatum: "Local Datum" (VDAT=24, NAP identity UNVERIFIED).

## Push auth note
GitHub HTTPS push requires a PAT. Previous session token has expired.
Remote: https://github.com/N13kx/Dolfhin_Nautical_navigation
User: N13kx / niekgirmscheid@gmail.com
Ask user to re-supply PAT when push is needed.
