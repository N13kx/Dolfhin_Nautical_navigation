---
name: Dolphin Navigation Architecture
description: Module layout, key decisions, and runtime crash fixes for the Dolphin PWA.
---

# Dolphin Alpha 0.1.1 Architecture

## Module layout (src/modules/)
- **map/** — MapMode/TrackingMode types, MAP_STYLES, overlayManager (hybrid tile overlays)
- **navigation/** — GpsPosition/GpsError/GpsQuality types, gpsUtils, useGeolocation hook
- **nautical/** — NauticalDataProvider interface (placeholder)
- **environment/** — WeatherProvider interface (placeholder)
- **vessel/** — Vessel/VesselState types, boatMarker DOM utilities
- **community/** — CommunityProvider interface (placeholder)
- **intelligence/** — Route planning types (placeholder)

## Service layout (src/services/)
- **search/types.ts** — SearchResult, SearchProvider interface
- **search/nominatim.ts** — Nominatim OSM geocoder

## Key decisions

### Hybrid mode fix
HYBRID_STYLE and SATELLITE_STYLE are separate object literals (same content, different references).
MapLibre compares style object references so separate objects guarantee styledata fires on Satellite↔Hybrid switch.
overlayManager listens to styledata and re-applies OpenSeaMap + demo route overlays after every style swap.
map.current is set to null BEFORE initialMap.remove() so post-removal styledata events don't apply overlays to a dead instance.

### Runtime crash fix (iPhone Safari — "null is not an object evaluating n2[0]")
Three converging bugs; all fixed:

**Bug 1 — center: undefined passed to MapLibre easeTo (PRIMARY)**
MapView.tsx was forwarding opts.center directly even when undefined.
MapLibre 5.x treats {center: undefined} differently from {}; in some internal paths it converts undefined to null before LngLat.convert(), which then does null[0] → crash.
Fix: MapView.easeTo() builds easeOptions conditionally — only adds center/bearing/zoom keys when the value is present AND Number.isFinite().

**Bug 2 — Orphaned Marker after StrictMode map recreation**
boatMarkerRef.current was never reset when the MapLibre map instance was destroyed and recreated (React StrictMode).
Calling marker.setLngLat() on a Marker attached to a removed map caused MapLibre to access null transform internals → null[0] crash.
Fix: DolphinApp tracks which map instance the marker was added to in markerMapRef. When the instance changes, the old marker is .remove()d and a new one is created on the new instance.

**Bug 3 — NaN heading not caught**
iOS Safari returns NaN (not null) for heading when stationary; heading !== null passes, NaN gets passed to MapLibre bearing → crash.
Fix: isValidHeading() uses Number.isFinite() instead of !== null throughout. Same for isValidSpeed().

### Diagnostic error boundary
diagnostics.ts holds a module-level snapshot (no coordinates) updated by DolphinApp every render.
ErrorBoundary.tsx is a React class component that catches React lifecycle errors AND installs window.onerror + window.unhandledrejection listeners for MapLibre event handler errors.
Vite HMR overlay is NOT suppressed.

### Tracking mode snap-back fix
trackingModeRef mirrors trackingMode state and is read inside the GPS position effect instead of the state value.
Prevents race where GPS update fires in same React scheduler tick as drag event.

### GPS staleness
useGeolocation runs setInterval every 5s to check if position.timestamp >10s old, marks isStale=true.

### GPS quality colors
good (≤10m): teal #44e4c2, moderate (≤30m): amber #f5a623, poor (>30m): red #e25555

### Search UX
SearchBar uses onPointerDown + preventDefault on result buttons to prevent input blur before selection on mobile.
Nominatim wrapped behind SearchProvider interface for future nautical search substitution.

### TrackingMode state machine
free → (tap locate) → follow → (tap locate) → courseUp → (tap locate) → free + bearing reset
drag OR rotate on map → free

## Build
Requires PORT and BASE_PATH env vars: `PORT=3000 BASE_PATH=/ pnpm run build`
Large chunk warning (~1270kb) — maplibre-gl is the main contributor; acceptable for MVP.
