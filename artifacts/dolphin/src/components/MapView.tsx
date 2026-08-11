import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapMode, MapViewRef, MapCenterOptions } from '../modules/map/types';
import { MAP_STYLES } from '../modules/map/styles';
import {
  BASE_STYLE_GROUP,
  getOverlaysForMode,
  applyOverlays,
  removeOverlays,
  applyLayerGroupVisibility,
} from '../modules/map/overlayManager';
import { IENC_CLICKABLE_LAYER_IDS, IENC_RUNTIME_SOURCE } from '../modules/nautical/iencLayers';
import { IencViewportController } from '../modules/nautical/catalogLoader';
import { ensurePmtilesProtocol } from '../modules/nautical/pmtilesProtocol';

export type { MapMode, MapViewRef };

interface MapViewProps {
  mode: MapMode;
  /**
   * Per-group layer visibility state (groupId → visible).
   * Applied via setLayoutProperty after overlays are added.
   * Groups with no entry in this map default to visible.
   */
  layerGroupVisibility: Record<string, boolean>;
  onMapLoad?: () => void;
  /** Called when the user drags or rotates the map — used to exit tracking mode */
  onUserInteraction?: () => void;
  /**
   * Called when the user taps an official IENC feature (nav mark or depth feature).
   * Receives the topmost MapLibre feature at the tap point.
   */
  onFeatureClick?: (feature: MapGeoJSONFeature) => void;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(
  ({ mode, layerGroupVisibility, onMapLoad, onUserInteraction, onFeatureClick }, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const modeRef = useRef<MapMode>(mode);
    const prevModeRef = useRef<MapMode>(mode);
    const onUserInteractionRef = useRef(onUserInteraction);
    const onFeatureClickRef = useRef(onFeatureClick);
    const layerGroupVisibilityRef = useRef(layerGroupVisibility);
    const iencControllerRef = useRef(new IencViewportController(import.meta.env.BASE_URL));
    const [webglFailed, setWebglFailed] = useState(false);

    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { onUserInteractionRef.current = onUserInteraction; }, [onUserInteraction]);
    useEffect(() => { onFeatureClickRef.current = onFeatureClick; }, [onFeatureClick]);
    useEffect(() => { layerGroupVisibilityRef.current = layerGroupVisibility; }, [layerGroupVisibility]);

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

      if (IENC_RUNTIME_SOURCE === 'pmtiles') ensurePmtilesProtocol();

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

      const modeShowsIenc = () => modeRef.current === 'Dolphin' || modeRef.current === 'Hybrid';
      const reconcileIenc = () => {
        if (IENC_RUNTIME_SOURCE !== 'catalog' || !modeShowsIenc() || !map.current) return;
        void iencControllerRef.current.reconcile(initialMap);
      };

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
        const overlays = getOverlaysForMode(modeRef.current);
        applyOverlays(initialMap, overlays);
        applyLayerGroupVisibility(initialMap, overlays, layerGroupVisibilityRef.current);
        iencControllerRef.current.invalidateStyle();
        reconcileIenc();
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
        const overlays = getOverlaysForMode(modeRef.current);
        applyOverlays(initialMap, overlays);
        applyLayerGroupVisibility(initialMap, overlays, layerGroupVisibilityRef.current);
        iencControllerRef.current.invalidateStyle();
        reconcileIenc();
      };
      initialMap.on('style.load', handleStyleLoad);

      // Reconcile only after camera movement settles. A short debounce coalesces
      // bursts from animated movement without issuing duplicate per-cell fetches.
      let moveEndTimer: ReturnType<typeof setTimeout> | null = null;
      const handleMoveEnd = () => {
        if (moveEndTimer) clearTimeout(moveEndTimer);
        moveEndTimer = setTimeout(reconcileIenc, 150);
      };
      initialMap.on('moveend', handleMoveEnd);

      // User drags or rotates → notify parent to exit tracking mode
      const handleUserInteraction = () => {
        onUserInteractionRef.current?.();
      };
      initialMap.on('dragstart', handleUserInteraction);
      initialMap.on('rotatestart', handleUserInteraction);

      // Global click listener for official IENC features.
      // Queries only layers that currently exist in the map (guards against
      // mode switches where IENC layers may be absent).
      const handleMapClick = (e: maplibregl.MapMouseEvent) => {
        if (!map.current || !onFeatureClickRef.current) return;
        const m = map.current;
        const clickable = IENC_CLICKABLE_LAYER_IDS.filter(
          (id) => m.getLayer(id) !== undefined
        );
        if (clickable.length === 0) return;
        const features = m.queryRenderedFeatures(e.point, { layers: clickable });
        if (features.length > 0) {
          onFeatureClickRef.current(features[0]);
        }
      };
      initialMap.on('click', handleMapClick);

      return () => {
        initialMap.off('style.load', handleStyleLoad);
        initialMap.off('dragstart', handleUserInteraction);
        initialMap.off('rotatestart', handleUserInteraction);
        initialMap.off('click', handleMapClick);
        initialMap.off('moveend', handleMoveEnd);
        if (moveEndTimer) clearTimeout(moveEndTimer);
        iencControllerRef.current.invalidateStyle();
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
     *   → setStyle fires style.load, which calls applyOverlays + applyLayerGroupVisibility.
     *
     * Overlay-only reconciliation (setStyle must NOT be called):
     *   Satellite ↔ Hybrid   ESRI ↔ ESRI — identical base content
     *   → setStyle produces a zero-diff; MapLibre emits no lifecycle events
     *     (neither styledata nor style.load fires), so overlays are never applied.
     *   → Instead: remove previous-mode overlays, add next-mode overlays directly,
     *     then apply group visibility.
     */
    useEffect(() => {
      if (!map.current) return;
      const m = map.current;
      const prevMode = prevModeRef.current;
      const nextMode = mode;

      if (BASE_STYLE_GROUP[prevMode] !== BASE_STYLE_GROUP[nextMode]) {
        // Base tiles change — swap style; handleStyleLoad applies new overlays + visibility.
        m.setStyle(MAP_STYLES[nextMode]);
      } else {
        // Same base tiles — reconcile overlays directly without touching the style.
        removeOverlays(m, getOverlaysForMode(prevMode));
        const nextOverlays = getOverlaysForMode(nextMode);
        applyOverlays(m, nextOverlays);
        applyLayerGroupVisibility(m, nextOverlays, layerGroupVisibilityRef.current);
        iencControllerRef.current.invalidateStyle();
        if (nextMode === 'Dolphin' || nextMode === 'Hybrid') {
          void iencControllerRef.current.reconcile(m);
        }
      }

      prevModeRef.current = nextMode;
    }, [mode]);

    /**
     * Visibility-only update: user toggles a layer group without changing mode.
     * Applies setLayoutProperty for all grouped layers in the current mode.
     * Safe to call when layers may not yet exist — applyLayerGroupVisibility guards.
     */
    useEffect(() => {
      if (!map.current) return;
      applyLayerGroupVisibility(
        map.current,
        getOverlaysForMode(modeRef.current),
        layerGroupVisibility
      );
    }, [layerGroupVisibility]);

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
