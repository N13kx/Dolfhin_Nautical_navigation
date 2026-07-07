---
name: Dolphin Architecture
description: Module layout, Hybrid mode fix, GPS tracking, search UX, nautical investigation findings.
---

## Module layout (confirmed on disk)

Only four real nautical/map modules exist:
- `modules/nautical/types.ts` — BBox, NauticalObject, DepthContour, NauticalDataProvider (placeholder interface)
- `modules/map/overlayManager.ts` — OverlaySpec, applyOverlays() (demo route + OpenSeaMap)
- `modules/map/styles.ts` — three MapLibre StyleSpecification literals (Dolphin/Satellite/Hybrid)
- `modules/map/types.ts` — MapMode, TrackingMode, MapViewRef

Community, environment, intelligence modules are interfaces only. NauticalLayerRegistry, useNauticalOverlays, NauticalObjectSheet, EncFeatureTypes do NOT exist on disk.

## Stabilization pass (v0.2)

- Hybrid mode: `osmVisible` initialized `true` so OpenSeaMap loads by default
- LayerSheet: mode cards and Hybrid toggle visible together (not close-before-visible)
- PDOK lines: removed from UI (fetch/cache preserved in overlayManager)

## Nautical investigation (v0.2.1)

Investigation report at `nautical-investigation/REPORT.md`. Key findings:

**Cells:** 1R76W8LI (edition 78, 2026-06-17, bbox 4.133°–4.333°E, 51.575°–51.625°N) and 1R7788RI (edition 46, 2026-06-29, bbox 4.333°–4.533°E, 51.625°–51.675°N). Both IENC Ed 2.4, 1:2000 scale, Rijkswaterstaat (AGEN=7979).

**Cells are diagonally adjacent** (corner-touching), NOT edge-adjacent — no seam analysis applies.

**GDAL:** 3.2.2 at `~/.nix-profile/bin/` (needs PATH export). S-57 driver confirmed. DSPM is not a separate GDAL layer — all DSID/DSSI/DSPM fields are in the DSID layer.

**Blocking unknowns before any depth display:**
- VDAT=24 and SDAT=42 exceed standard S-57 tables — exact datum UNKNOWN, requires IENC Product Specification 2.4
- Rijkswaterstaat data licence terms unconfirmed

**Why:** Depth values are safety-critical; displaying them against an unknown datum could mislead sailors.

**GDAL sign convention:** Z values are elevations — negative Z = below sounding datum (navigable depth), positive Z = above datum (dry/shallow).
