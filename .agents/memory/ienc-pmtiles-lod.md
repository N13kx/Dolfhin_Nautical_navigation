---
name: IENC PMTiles LOD
description: Two-layer progressive sounding strategy for DOL-017b; tippecanoe version and sparse selection rules.
---

## Two source-layer LOD design

MacBook crashes with 435,082 soundings in a single PMTiles source layer at zoom 10+. A/B test (DOL-017) confirmed soundings are the sole crash trigger.

**Fix:** two PMTiles source layers for soundings, partitioned by tile zoom.

| PMTiles layer | Tile zoom | MapLibre layer zoom | Feature count |
|---|---|---|---|
| `soundings-sparse` | 8–11 | 10–11 | ~49 k (grid + above/at) |
| `soundings` | 12–16 | 12+ | 435,082 (full) |

MapLibre only decodes `soundings-sparse` at low zoom and `soundings` at high zoom — no unnecessary feature density loaded.

## Sparse selection algorithm (prepare-pmtiles-input.cjs)

- **Below-datum:** one shallowest feature per 0.01° × 0.01° grid cell (~1 km). Yields 3,466 grid cells for Zeeland.
- **Above/at:** all included verbatim (safety-critical drying heights and datum-level). Zeeland has 45,754 of these (extensive tidal flats / delta).
- Total sparse: 49,220 features. No synthetic or averaged values.

**Why:** point geometry doesn't trigger tippecanoe's 500 KB tile-drop threshold. All 435 k soundings were decoded at zoom 10, crashing the MacBook GPU. The grid selection moves density reduction to the tile-build phase, not MapLibre rendering.

## MapLibre layer IDs

- `ienc-soundings-sparse-point` — circle hit-target, minzoom 10, maxzoom 12
- `ienc-soundings-sparse-label` — symbol labels, minzoom 10, maxzoom 12, text-padding zoom 10→40px, 11→15px
- `ienc-soundings-point` — circle hit-target, minzoom 12
- `ienc-soundings-label` — symbol labels, minzoom 12, text-padding 12→30px, 14→8px, 16→2px

## Tippecanoe

- Version 2.78.0 installed via `pkgs.tippecanoe` (Nix, added to replit.nix).
- build-pmtiles.sh updated from exact version check to minimum-version check (≥ 2.29.0).
- Per-layer zoom range via JSON `-L` spec format: `{"file":"...","layer":"name","minzoom":N,"maxzoom":N}`.

## Runtime env (normal)

- `VITE_IENC_SOURCE=pmtiles`
- `VITE_IENC_DIAGNOSTIC_LAYERS` — must be ABSENT (deleted after DOL-017 A/B test)

**How to apply:** whenever adding new sounding source layers, keep them partitioned at the tile-build level (tippecanoe JSON spec minzoom/maxzoom), not only at the MapLibre layer level.
