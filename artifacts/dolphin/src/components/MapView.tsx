import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type MapMode = 'Dolphin' | 'Satellite' | 'Hybrid';

interface MapViewProps {
  mode: MapMode;
  onMapLoad?: () => void;
}

export interface MapViewRef {
  getMap: () => maplibregl.Map | null;
}

const STYLES = {
  Dolphin: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  },
  Satellite: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles © Esri'
      }
    },
    layers: [
      {
        id: 'esri-satellite',
        type: 'raster',
        source: 'esri',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  },
  Hybrid: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles © Esri'
      }
    },
    layers: [
      {
        id: 'esri-satellite',
        type: 'raster',
        source: 'esri',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  }
};

const DEMO_ROUTE = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [4.265, 51.49],
      [4.33, 51.54],
      [4.39, 51.59],
      [4.43, 51.66]
    ]
  }
};

export const MapView = forwardRef<MapViewRef, MapViewProps>(({ mode, onMapLoad }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const modeRef = useRef<MapMode>(mode); // always current, readable inside stale closures
  const [webglFailed, setWebglFailed] = useState(false);

  // Keep modeRef in sync with prop
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useImperativeHandle(ref, () => ({
    getMap: () => map.current
  }));

  const addRouteLayer = useCallback(() => {
    if (!map.current) return;
    const currentMode = modeRef.current;
    if (currentMode !== 'Dolphin' && currentMode !== 'Hybrid') return;

    if (!map.current.getSource('demo-route')) {
      map.current.addSource('demo-route', {
        type: 'geojson',
        data: DEMO_ROUTE as maplibregl.GeoJSONSourceSpecification['data']
      });
    }

    if (!map.current.getLayer('demo-route-line')) {
      map.current.addLayer({
        id: 'demo-route-line',
        type: 'line',
        source: 'demo-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#44e4c2',
          'line-width': 5,
          'line-opacity': 0.9
        }
      });
    }
  }, []); // safe: reads modeRef (a ref) at call time, not at capture time

  useEffect(() => {
    if (!mapContainer.current) return;

    // Check WebGL support before attempting to create the map
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      setWebglFailed(true);
      return;
    }

    let initialMap: maplibregl.Map;
    try {
      initialMap = new maplibregl.Map({
        container: mapContainer.current,
        style: STYLES[modeRef.current] as maplibregl.StyleSpecification,
        center: [4.303, 51.494] as [number, number],
        zoom: 10.7,
        attributionControl: false
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    map.current = initialMap;

    initialMap.on('error', (e) => {
      if ((e.error as Error | undefined)?.message?.toLowerCase().includes('webgl')) {
        map.current?.remove();
        map.current = null;
        setWebglFailed(true);
      }
    });

    initialMap.on('load', () => {
      addRouteLayer();
      onMapLoad?.();
    });

    // Re-add route layer after every style swap
    initialMap.on('styledata', addRouteLayer);

    return () => {
      initialMap.off('styledata', addRouteLayer);
      initialMap.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional one-time init

  useEffect(() => {
    if (map.current) {
      map.current.setStyle(STYLES[mode] as maplibregl.StyleSpecification);
    }
  }, [mode]);

  if (webglFailed) {
    return (
      <div className="w-full h-full absolute inset-0 bg-[#071820] flex flex-col items-center justify-center gap-4" data-testid="map-fallback">
        <div className="text-[#44e4c2] text-5xl opacity-60">◎</div>
        <p className="text-white/50 text-sm text-center max-w-xs leading-relaxed">
          Kaart vereist WebGL — open Dolphin in een moderne browser of de native app.
        </p>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-full absolute inset-0 bg-[#071820]" data-testid="map-container" />;
});

MapView.displayName = 'MapView';
