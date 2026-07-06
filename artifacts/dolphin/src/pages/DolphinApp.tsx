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
import type { MapMode, MapViewRef, TrackingMode } from '../modules/map/types';
import type { SearchResult } from '../services/search/types';

export function DolphinApp() {
  const mapRef = useRef<MapViewRef>(null);
  const boatMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [mapMode, setMapMode] = useState<MapMode>('Dolphin');
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('follow');
  const [isLayerSheetOpen, setIsLayerSheetOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [hasInitialFix, setHasInitialFix] = useState(false);

  const { position, quality, error, isTracking, start: startGps, stop: stopGps } = useGeolocation();

  // Ref mirrors trackingMode state so GPS-update effects always read the latest
  // value without being stale between React render cycles (prevents snap-back
  // when a position update and a drag fire in the same scheduler tick).
  const trackingModeRef = useRef<TrackingMode>(trackingMode);
  useEffect(() => { trackingModeRef.current = trackingMode; }, [trackingMode]);

  // Start GPS on mount; stop on unmount (hook guards against duplicate starts)
  useEffect(() => {
    startGps();
    return () => stopGps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // GPS error messages
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
  // Reads trackingModeRef.current (not state) to get the latest mode at execution
  // time, preventing the snap-back race where a GPS update fires in the same
  // React scheduler tick as a drag event that sets mode to 'free'.
  useEffect(() => {
    if (!position) return;

    const { latitude, longitude, heading } = position;
    const map = mapRef.current?.getMap();

    // Create or update the boat marker
    if (map) {
      if (!boatMarkerRef.current) {
        const el = createBoatMarkerElement();
        boatMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(map);
      } else {
        boatMarkerRef.current.setLngLat([longitude, latitude]);
        if (heading !== null) {
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
      mapRef.current?.easeTo({
        center: [longitude, latitude],
        bearing: heading ?? 0,
        duration: 600,
      });
    }
    // 'free': do nothing — let the user pan freely
  }, [position, hasInitialFix]); // trackingMode intentionally omitted — read via ref

  // Map drag → exit tracking mode
  const handleMapUserInteraction = useCallback(() => {
    setTrackingMode('free');
  }, []);

  // Locate button cycles: free → follow → courseUp → free (north-up reset)
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

    if (trackingMode === 'free') {
      setTrackingMode('follow');
      mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 15, duration: 800 });
      setToastMsg('Positie volgen');
    } else if (trackingMode === 'follow') {
      setTrackingMode('courseUp');
      mapRef.current?.easeTo({
        center: [longitude, latitude],
        bearing: heading ?? 0,
        zoom: 15,
        duration: 800,
      });
      setToastMsg('Koers omhoog');
    } else {
      // courseUp → free + reset bearing to north
      setTrackingMode('free');
      mapRef.current?.easeTo({ bearing: 0, duration: 600 });
      setToastMsg('Noord omhoog');
    }
  }, [isTracking, position, trackingMode, startGps]);

  // Search result → fly to location, exit tracking
  const handleSearchResult = useCallback((result: SearchResult) => {
    setTrackingMode('free');
    const map = mapRef.current?.getMap();

    if (result.bbox && map) {
      map.fitBounds(
        [[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]],
        { padding: 60, duration: 1000, maxZoom: 15 }
      );
    } else {
      mapRef.current?.easeTo({ center: result.center, zoom: 14, duration: 1000 });
    }

    setToastMsg(result.name);
  }, []);

  const sog = position?.speed != null ? metersPerSecondToKnots(position.speed) : null;
  const cog = position?.heading ?? null;

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
