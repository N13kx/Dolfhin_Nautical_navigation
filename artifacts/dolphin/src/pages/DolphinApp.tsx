import { useState, useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { useGeolocation } from '../hooks/useGeolocation';
import { MapView, type MapViewRef, type MapMode } from '../components/MapView';
import { TopBar } from '../components/TopBar';
import { SearchBar } from '../components/SearchBar';
import { StatusStrip } from '../components/StatusStrip';
import { LocateButton } from '../components/LocateButton';
import { LayerSheet } from '../components/LayerSheet';
import { Toast } from '../components/Toast';
import { createBoatMarkerElement } from '../components/BoatMarker';

export function DolphinApp() {
  const mapRef = useRef<MapViewRef>(null);
  const boatMarkerRef = useRef<maplibregl.Marker | null>(null);
  
  const [mapMode, setMapMode] = useState<MapMode>('Dolphin');
  const [isLayerSheetOpen, setIsLayerSheetOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  const [hasInitialFix, setHasInitialFix] = useState(false);
  const [sog, setSog] = useState<number | null>(null);
  const [cog, setCog] = useState<number | null>(null);
  const [gpsAcc, setGpsAcc] = useState<number | null>(null);

  const { position, error, isTracking, start: startGps, stop: stopGps } = useGeolocation();

  // Start GPS on mount; stop on unmount (StrictMode-safe: hook guards duplicate starts)
  useEffect(() => {
    startGps();
    return () => stopGps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — startGps/stopGps are stable callbacks

  // Handle Error Toast
  useEffect(() => {
    if (error) {
      let msg = 'GPS fout opgetreden.';
      if (error.code === error.PERMISSION_DENIED) msg = 'Geen toegang tot locatie. Controleer je instellingen.';
      if (error.code === error.POSITION_UNAVAILABLE) msg = 'Locatie onbekend. Zoeken naar signaal...';
      if (error.code === error.TIMEOUT) msg = 'Time-out bij zoeken naar locatie.';
      setToastMsg(msg);
    }
  }, [error]);

  // Handle GPS Updates
  useEffect(() => {
    if (position) {
      const { latitude, longitude, speed, heading, accuracy } = position.coords;
      
      // Update status strip (speed is m/s -> knots)
      const speedKnots = speed !== null ? speed * 1.94384 : null;
      setSog(speedKnots);
      setCog(heading);
      setGpsAcc(accuracy);

      const map = mapRef.current?.getMap();
      if (!map) return;

      // Update Marker
      if (!boatMarkerRef.current) {
        const el = createBoatMarkerElement();
        boatMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(map);
      } else {
        boatMarkerRef.current.setLngLat([longitude, latitude]);
        
        // Rotate marker if we have heading
        if (heading !== null) {
          const el = boatMarkerRef.current.getElement();
          const triangle = el.querySelector('div > div:nth-child(2)') as HTMLElement;
          if (triangle) {
            triangle.style.transform = `translateY(-1px) rotate(${heading}deg)`;
          }
        }
      }

      // First fix: center map
      if (!hasInitialFix) {
        map.easeTo({
          center: [longitude, latitude],
          zoom: 15,
          duration: 1200
        });
        setHasInitialFix(true);
      }
    }
  }, [position, hasInitialFix]);

  const handleLocateClick = () => {
    if (!isTracking) {
      startGps();
      setToastMsg("GPS gestart...");
      return;
    }

    if (position) {
      const map = mapRef.current?.getMap();
      if (map) {
        map.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15,
          duration: 800
        });
      }
    } else {
      setToastMsg("Wachten op GPS signaal...");
    }
  };

  const handleSearchSubmit = () => {
    setToastMsg("Zoeken koppelen we in Alpha 0.2 aan geocoding en vaarwegobjecten.");
  };

  return (
    <div className="relative w-screen h-[100dvh] bg-[#071820] overflow-hidden">
      <MapView ref={mapRef} mode={mapMode} />

      <TopBar 
        onLayersClick={() => setIsLayerSheetOpen(true)}
        onSearchFocus={() => setIsSearchFocused(true)}
      />

      <SearchBar 
        isFocusedExternally={isSearchFocused}
        onBlurExternally={() => setIsSearchFocused(false)}
        onSearchSubmit={handleSearchSubmit}
      />

      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />

      <LocateButton onClick={handleLocateClick} isTracking={isTracking} />

      <StatusStrip sog={sog} cog={cog} gpsAcc={gpsAcc} />

      <LayerSheet 
        isOpen={isLayerSheetOpen}
        activeMode={mapMode}
        onModeSelect={setMapMode}
        onClose={() => setIsLayerSheetOpen(false)}
      />
    </div>
  );
}
