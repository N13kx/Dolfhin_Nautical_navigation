import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapMode, MapViewRef, MapCenterOptions } from '../modules/map/types';
import { MAP_STYLES } from '../modules/map/styles';
import { getOverlaysForMode, applyOverlays } from '../modules/map/overlayManager';

export type { MapMode, MapViewRef };

interface MapViewProps {
  mode: MapMode;
  onMapLoad?: () => void;
  /** Called when the user drags or rotates the map — used to exit tracking mode */
  onUserInteraction?: () => void;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(
  ({ mode, onMapLoad, onUserInteraction }, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const modeRef = useRef<MapMode>(mode);
    const onUserInteractionRef = useRef(onUserInteraction);
    const [webglFailed, setWebglFailed] = useState(false);

    // Keep refs current so stale closures inside map event handlers always read
    // the latest mode and callback without triggering re-registration.
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { onUserInteractionRef.current = onUserInteraction; }, [onUserInteraction]);

    useImperativeHandle(ref, () => ({
      getMap: () => map.current,
      easeTo: (opts: MapCenterOptions) => {
        if (!map.current) return;
        map.current.easeTo({
          center: opts.center,
          bearing: opts.bearing,
          zoom: opts.zoom,
          duration: opts.duration ?? 800,
        });
      },
    }));

    // One-time map initialization
    useEffect(() => {
      if (!mapContainer.current) return;

      // Pre-check WebGL availability before handing control to MapLibre
      const testCanvas = document.createElement('canvas');
      const gl =
        testCanvas.getContext('webgl') ||
        testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglFailed(true);
        return;
      }

      let initialMap: maplibregl.Map;
      try {
        initialMap = new maplibregl.Map({
          container: mapContainer.current,
          style: MAP_STYLES[modeRef.current],
          center: [4.303, 51.494],
          zoom: 10.7,
          attributionControl: false,
        });
      } catch {
        setWebglFailed(true);
        return;
      }

      map.current = initialMap;

      // WebGL runtime failure (e.g. context lost)
      initialMap.on('error', (e) => {
        const msg = (e.error as Error | undefined)?.message?.toLowerCase() ?? '';
        if (msg.includes('webgl')) {
          map.current?.remove();
          map.current = null;
          setWebglFailed(true);
        }
      });

      // Initial overlays after first load
      initialMap.on('load', () => {
        applyOverlays(initialMap, getOverlaysForMode(modeRef.current));
        onMapLoad?.();
      });

      // Re-apply overlays after every style swap (setStyle() wipes all sources+layers)
      const handleStyleData = () => {
        applyOverlays(initialMap, getOverlaysForMode(modeRef.current));
      };
      initialMap.on('styledata', handleStyleData);

      // User drags or rotates → notify parent to exit tracking mode
      const handleUserInteraction = () => {
        onUserInteractionRef.current?.();
      };
      initialMap.on('dragstart', handleUserInteraction);
      initialMap.on('rotatestart', handleUserInteraction);

      return () => {
        initialMap.off('styledata', handleStyleData);
        initialMap.off('dragstart', handleUserInteraction);
        initialMap.off('rotatestart', handleUserInteraction);
        initialMap.remove();
        map.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional one-time init

    // Mode changes swap the base style; overlays are restored by the styledata handler above
    useEffect(() => {
      if (map.current) {
        map.current.setStyle(MAP_STYLES[mode]);
      }
    }, [mode]);

    if (webglFailed) {
      return (
        <div
          className="w-full h-full absolute inset-0 bg-[#071820] flex flex-col items-center justify-center gap-4"
          data-testid="map-fallback"
        >
          <div className="text-[#44e4c2] text-5xl opacity-60">◎</div>
          <p className="text-white/50 text-sm text-center max-w-xs leading-relaxed">
            Kaart vereist WebGL — open Dolphin in een moderne browser of de native app.
          </p>
        </div>
      );
    }

    return (
      <div
        ref={mapContainer}
        className="w-full h-full absolute inset-0 bg-[#071820]"
        data-testid="map-container"
      />
    );
  }
);

MapView.displayName = 'MapView';
