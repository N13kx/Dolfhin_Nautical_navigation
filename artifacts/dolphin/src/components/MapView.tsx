import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapMode, MapViewRef, MapCenterOptions } from '../modules/map/types';
import { MAP_STYLES } from '../modules/map/styles';
import {
  BASE_STYLE_GROUP,
  getOverlaysForMode,
  applyOverlays,
  removeOverlays,
} from '../modules/map/overlayManager';

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
    const prevModeRef = useRef<MapMode>(mode);
    const onUserInteractionRef = useRef(onUserInteraction);
    const [webglFailed, setWebglFailed] = useState(false);

    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { onUserInteractionRef.current = onUserInteraction; }, [onUserInteraction]);

    useImperativeHandle(ref, () => ({
      getMap: () => map.current,

      easeTo: (opts: MapCenterOptions) => {
        if (!map.current) return;

        /**
         * Build options without undefined keys.
         *
         * MapLibre 5.x treats { center: undefined } differently from {}.
         * An explicit `center: undefined` can enter a null-conversion path
         * inside LngLat.convert, producing "null is not an object (evaluating 'n[0]')".
         *
         * We also validate every numeric value with Number.isFinite so that NaN
         * coordinates (e.g. from a sensor that returns NaN instead of null) never
         * reach MapLibre's internal geometry pipeline.
         */
        const rawDuration = opts.duration ?? 800;
        const easeOptions: maplibregl.EaseToOptions = {
          duration: Number.isFinite(rawDuration) ? rawDuration : 800,
        };

        if (opts.center !== undefined) {
          const [lng, lat] = opts.center;
          if (Number.isFinite(lng) && Number.isFinite(lat)) {
            easeOptions.center = [lng, lat];
          } else {
            console.warn('[MapView] easeTo: center contains non-finite coordinates, skipping', opts.center);
          }
        }

        if (opts.bearing !== undefined) {
          if (Number.isFinite(opts.bearing)) {
            easeOptions.bearing = opts.bearing;
          } else {
            console.warn('[MapView] easeTo: bearing is non-finite, skipping', opts.bearing);
          }
        }

        if (opts.zoom !== undefined) {
          if (Number.isFinite(opts.zoom)) {
            easeOptions.zoom = opts.zoom;
          } else {
            console.warn('[MapView] easeTo: zoom is non-finite, skipping', opts.zoom);
          }
        }

        map.current.easeTo(easeOptions);
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

      // Initial overlays after first style load
      initialMap.on('load', () => {
        applyOverlays(initialMap, getOverlaysForMode(modeRef.current));
        onMapLoad?.();
      });

      // Re-apply overlays after a real base-style swap (setStyle with different base).
      //
      // This handler is ONLY reached when the base tile set changes (e.g. OSM → ESRI or
      // ESRI → OSM). Same-base transitions (Satellite ↔ Hybrid) never call setStyle, so
      // they never reach this handler — their overlays are reconciled directly in the
      // mode-change effect below.
      const handleStyleLoad = () => {
        if (!map.current) return;
        applyOverlays(initialMap, getOverlaysForMode(modeRef.current));
      };
      initialMap.on('style.load', handleStyleLoad);

      // User drags or rotates → notify parent to exit tracking mode
      const handleUserInteraction = () => {
        onUserInteractionRef.current?.();
      };
      initialMap.on('dragstart', handleUserInteraction);
      initialMap.on('rotatestart', handleUserInteraction);

      return () => {
        initialMap.off('style.load', handleStyleLoad);
        initialMap.off('dragstart', handleUserInteraction);
        initialMap.off('rotatestart', handleUserInteraction);
        // Null the ref BEFORE remove() so that any in-flight events queued
        // during removal don't attempt to apply overlays to a dead instance.
        map.current = null;
        initialMap.remove();
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional one-time init

    /**
     * Mode transition — separates base-style lifecycle from overlay lifecycle.
     *
     * Base-style lifecycle (setStyle required):
     *   Dolphin ↔ Satellite  OSM ↔ ESRI — full style reload
     *   Dolphin ↔ Hybrid     OSM ↔ ESRI — full style reload
     *   → setStyle fires style.load, which calls applyOverlays for the new mode.
     *
     * Overlay-only reconciliation (setStyle must NOT be called):
     *   Satellite ↔ Hybrid   ESRI ↔ ESRI — identical base content
     *   → setStyle produces a zero-diff; MapLibre emits no lifecycle events
     *     (neither styledata nor style.load fires), so overlays are never applied.
     *   → Instead: remove previous-mode overlays, add next-mode overlays directly.
     */
    useEffect(() => {
      if (!map.current) return;
      const m = map.current;
      const prevMode = prevModeRef.current;
      const nextMode = mode;

      if (BASE_STYLE_GROUP[prevMode] !== BASE_STYLE_GROUP[nextMode]) {
        // Base tiles change — swap style; handleStyleLoad applies the new overlays.
        m.setStyle(MAP_STYLES[nextMode]);
      } else {
        // Same base tiles — reconcile overlays directly without touching the style.
        removeOverlays(m, getOverlaysForMode(prevMode));
        applyOverlays(m, getOverlaysForMode(nextMode));
      }

      prevModeRef.current = nextMode;
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
