import { useState, useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useGeolocation } from '../modules/navigation/useGeolocation';
import { metersPerSecondToKnots } from '../modules/navigation/gpsUtils';
import { createBoatMarkerElement, updateBoatHeading } from '../modules/vessel/boatMarker';
import { MapView } from '../components/MapView';
import { TopBar } from '../components/TopBar';
import { SearchBar } from '../components/SearchBar';
import { StatusStrip } from '../components/StatusStrip';
import { LocateButton } from '../components/LocateButton';
import { LayerSheet } from '../components/LayerSheet';
import { Toast } from '../components/Toast';
import { updateDiagnostics } from '../diagnostics';
import type { MapMode, MapViewRef, TrackingMode } from '../modules/map/types';
import type { SearchResult } from '../services/search/types';

/** Heading is considered valid only when it is a finite number (not null, not NaN) */
function isValidHeading(h: number | null): h is number {
  return h !== null && Number.isFinite(h);
}

/** Speed is considered valid only when it is a non-negative finite number */
function isValidSpeed(s: number | null): s is number {
  return s !== null && Number.isFinite(s) && s >= 0;
}

export function DolphinApp() {
  const mapRef = useRef<MapViewRef>(null);
  const boatMarkerRef = useRef<maplibregl.Marker | null>(null);

  /**
   * Tracks which map instance the boat marker was added to.
   * When the map instance changes (StrictMode recreation or future remount),
   * the old marker is cleaned up before a new one is created on the new instance.
   * This prevents calling Marker.setLngLat() on a marker attached to a removed
   * map — which causes MapLibre to access null transform internals → crash.
   */
  const markerMapRef = useRef<maplibregl.Map | null>(null);

  /** Counts how many distinct MapLibre instances have been initialised (for diagnostics) */
  const mapInstanceCountRef = useRef(0);

  const [mapMode, setMapMode] = useState<MapMode>('Dolphin');
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('follow');
  const [isLayerSheetOpen, setIsLayerSheetOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [hasInitialFix, setHasInitialFix] = useState(false);

  const { position, quality, error, isTracking, start: startGps, stop: stopGps } = useGeolocation();

  // Ref mirrors trackingMode state so GPS effects always read the latest value
  // without being stale between React render cycles (prevents snap-back race).
  const trackingModeRef = useRef<TrackingMode>(trackingMode);
  useEffect(() => { trackingModeRef.current = trackingMode; }, [trackingMode]);

  // Keep diagnostics current — no coordinates stored
  useEffect(() => {
    updateDiagnostics({
      mapMode,
      overlayMode: mapMode,          // mirrors mapMode (base layer / overlay selection)
      trackingMode,
      hasPosition: position !== null,
      headingFinite: isValidHeading(position?.heading ?? null),
      headingApprox: isValidHeading(position?.heading ?? null)
        ? `${Math.round((position!.heading! / 10)) * 10}°`
        : 'n/a',
      speedFinite: isValidSpeed(position?.speed ?? null),
      speedApprox: isValidSpeed(position?.speed ?? null)
        ? `${metersPerSecondToKnots(position!.speed!).toFixed(1)} kts`
        : 'n/a',
      gpsQuality: quality,
      isStale: position?.isStale ?? false,
    });
  });

  // Start GPS on mount; stop on unmount (hook guards against duplicate starts)
  useEffect(() => {
    startGps();
    return () => stopGps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // GPS error → toast
  useEffect(() => {
    if (!error) return;
    const messages: Record<string, string> = {
      permission_denied: 'Geen toegang tot locatie. Controleer je instellingen.',
      unavailable: 'Locatie onbekend. Zoeken naar signaal...',
      timeout: 'Time-out bij zoeken naar locatie.',
      unsupported: 'GPS wordt niet ondersteund door deze browser.',
      unknown: 'GPS fout opgetreden.',
    };
    setToastMsg(messages[error.code] ?? messages.unknown);
  }, [error]);

  // GPS position updates → update marker + apply tracking
  useEffect(() => {
    if (!position) return;

    const { latitude, longitude, heading, speed } = position;

    // Guard: validate coordinates are real numbers before using them
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn('[DolphinApp] GPS position contains non-finite coordinates, skipping update');
      return;
    }

    const currentMap = mapRef.current?.getMap();

    // Detect map instance change (StrictMode recreation or future remount).
    // If the map was replaced, the old Marker is now attached to a removed map.
    // Calling setLngLat() on it would make MapLibre access null internals → crash.
    if (currentMap !== markerMapRef.current) {
      if (boatMarkerRef.current) {
        try {
          boatMarkerRef.current.remove();
        } catch {
          // Best-effort — marker may already be detached from removed map
        }
        boatMarkerRef.current = null;
      }
      markerMapRef.current = currentMap ?? null;
      if (currentMap) {
        mapInstanceCountRef.current += 1;
        updateDiagnostics({ mapInstanceCount: mapInstanceCountRef.current });
      }
    }

    if (currentMap) {
      if (!boatMarkerRef.current) {
        // Create fresh marker on this map instance
        const el = createBoatMarkerElement();
        boatMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(currentMap);
        markerMapRef.current = currentMap;
      } else {
        boatMarkerRef.current.setLngLat([longitude, latitude]);
        // Only rotate arrow when heading is a real number (not null, not NaN)
        if (isValidHeading(heading)) {
          updateBoatHeading(boatMarkerRef.current.getElement(), heading);
        }
      }
    }

    // First fix: always center the map regardless of tracking mode
    if (!hasInitialFix) {
      mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 15, duration: 1200 });
      setHasInitialFix(true);
      return;
    }

    // Read ref for latest mode — avoids stale closure race with drag events
    const currentMode = trackingModeRef.current;
    if (currentMode === 'follow') {
      mapRef.current?.easeTo({ center: [longitude, latitude], duration: 600 });
    } else if (currentMode === 'courseUp') {
      // Use isValidHeading so NaN heading does not reach MapLibre bearing pipeline
      const bearing = isValidHeading(heading) ? heading : 0;
      mapRef.current?.easeTo({ center: [longitude, latitude], bearing, duration: 600 });
    }
    // 'free': do nothing — user is panning freely
  }, [position, hasInitialFix]); // trackingMode intentionally read via ref

  // Map drag/rotate → exit tracking mode
  const handleMapUserInteraction = useCallback(() => {
    setTrackingMode('free');
  }, []);

  // Locate button: cycles free → follow → courseUp → free (north-up reset)
  const handleLocateClick = useCallback(() => {
    if (!isTracking) {
      startGps();
      setToastMsg('GPS gestart...');
      return;
    }

    if (!position) {
      setToastMsg('Wachten op GPS signaal...');
      return;
    }

    const { longitude, latitude, heading } = position;

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

    if (trackingMode === 'free') {
      setTrackingMode('follow');
      mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 15, duration: 800 });
      setToastMsg('Positie volgen');
    } else if (trackingMode === 'follow') {
      setTrackingMode('courseUp');
      // Guard bearing: use 0 if heading is absent or NaN (e.g. stationary on iOS)
      const bearing = isValidHeading(heading) ? heading : 0;
      mapRef.current?.easeTo({ center: [longitude, latitude], bearing, zoom: 15, duration: 800 });
      setToastMsg('Koers omhoog');
    } else {
      // courseUp → free + reset bearing (north-up); no center → keep current camera center
      setTrackingMode('free');
      mapRef.current?.easeTo({ bearing: 0, duration: 600 });
      setToastMsg('Noord omhoog');
    }
  }, [isTracking, position, trackingMode, startGps]);

  // Search result → fly to location, exit tracking
  const handleSearchResult = useCallback((result: SearchResult) => {
    const [lng, lat] = result.center;

    // Validate before passing to MapLibre
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      console.warn('[DolphinApp] Search result has invalid coordinates', result.id);
      return;
    }

    setTrackingMode('free');
    const map = mapRef.current?.getMap();

    if (result.bbox && map) {
      const [west, south, east, north] = result.bbox;
      // Validate all four bbox values
      if (
        Number.isFinite(west) && Number.isFinite(south) &&
        Number.isFinite(east) && Number.isFinite(north)
      ) {
        map.fitBounds(
          [[west, south], [east, north]],
          { padding: 60, duration: 1000, maxZoom: 15 }
        );
        setToastMsg(result.name);
        return;
      }
    }

    mapRef.current?.easeTo({ center: [lng, lat], zoom: 14, duration: 1000 });
    setToastMsg(result.name);
  }, []);

  // Derive display values — guard against non-finite sensor values
  const sog = isValidSpeed(position?.speed ?? null)
    ? metersPerSecondToKnots(position!.speed!)
    : null;
  const cog = isValidHeading(position?.heading ?? null) ? position!.heading! : null;

  return (
    <div className="relative w-screen h-[100dvh] bg-[#071820] overflow-hidden">
      <MapView
        ref={mapRef}
        mode={mapMode}
        onUserInteraction={handleMapUserInteraction}
      />

      <TopBar
        onLayersClick={() => setIsLayerSheetOpen(true)}
        onSearchFocus={() => setIsSearchFocused(true)}
      />

      <SearchBar
        isFocusedExternally={isSearchFocused}
        onBlurExternally={() => setIsSearchFocused(false)}
        onResultSelect={handleSearchResult}
      />

      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />

      <LocateButton
        onClick={handleLocateClick}
        trackingMode={trackingMode}
        hasPosition={position !== null}
      />

      <StatusStrip
        sog={sog}
        cog={cog}
        gpsAcc={position?.accuracy ?? null}
        gpsQuality={quality}
        isStale={position?.isStale ?? false}
      />

      <LayerSheet
        isOpen={isLayerSheetOpen}
        activeMode={mapMode}
        onModeSelect={(mode) => {
          setMapMode(mode);
          setIsLayerSheetOpen(false);
        }}
        onClose={() => setIsLayerSheetOpen(false)}
      />
    </div>
  );
}
