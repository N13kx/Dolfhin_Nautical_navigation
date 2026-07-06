---
name: Dolphin Navigation Architecture
description: Module layout, key decisions, and gotchas for the Dolphin PWA refactor.
---

# Dolphin Alpha 0.1.1 Architecture

## Module layout (src/modules/)
- **map/** — MapMode/TrackingMode types, MAP_STYLES, overlayManager (hybrid tile overlays)
- **navigation/** — GpsPosition/GpsError/GpsQuality types, gpsUtils (quality thresholds, stale check), useGeolocation hook
- **nautical/** — NauticalDataProvider interface (placeholder, unimplemented)
- **environment/** — WeatherProvider interface (placeholder, unimplemented)
- **vessel/** — Vessel/VesselState types, boatMarker DOM utilities
- **community/** — CommunityProvider interface (placeholder, unimplemented)
- **intelligence/** — Route planning types (placeholder, unimplemented)

## Service layout (src/services/)
- **search/types.ts** — SearchResult, SearchProvider interface
- **search/nominatim.ts** — Nominatim OSM geocoder implementation

## Key decisions

### Hybrid mode fix
HYBRID_STYLE and SATELLITE_STYLE are separate object literals (same content, different references).
MapLibre calls setStyle by comparing references, so separate objects guarantee styledata fires on Satellite↔Hybrid switch.
overlayManager listens to styledata and re-applies OpenSeaMap + demo route overlays after every style swap.

### Tracking mode snap-back fix
trackingModeRef mirrors trackingMode state and is read inside the GPS position effect instead of the state value.
This prevents the race where a GPS update fires in the same React scheduler tick as a drag event.

### GPS staleness
useGeolocation runs a setInterval every 5s to check if position.timestamp is >10s old and marks isStale=true.
StatusStrip shows "Verlopen" label in muted color when stale.

### GPS quality colors
good (<=10m): teal #44e4c2, moderate (<=30m): amber #f5a623, poor (>30m): red #e25555

### Search UX
SearchBar uses onPointerDown + preventDefault on result buttons to prevent input blur before selection fires (works on mobile touch events too).
Nominatim is wrapped behind the SearchProvider interface so future nautical search can be substituted.

### TrackingMode state machine
free → (tap locate) → follow → (tap locate) → courseUp → (tap locate) → free + bearing reset
drag on map OR rotate on map → free
rotatestart also triggers free mode (not just dragstart).

## Build
Requires PORT and BASE_PATH env vars: `PORT=3000 BASE_PATH=/ pnpm run build`
Large chunk warning (1267kb) — maplibre-gl is the main contributor; acceptable for MVP.
