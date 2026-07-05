import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeolocationState {
  position: GeolocationPosition | null;
  error: GeolocationPositionError | null;
  isTracking: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    isTracking: false,
  });

  const watchIdRef = useRef<number | null>(null);

  // Cleanup on unmount — always clear any active watcher
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setState(s => ({ ...s, isTracking: false }));
    }
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState(s => ({
        ...s,
        error: {
          code: 0,
          message: 'Geolocation is not supported by this browser.',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
      }));
      return;
    }

    // Guard against duplicate starts
    if (watchIdRef.current !== null) return;

    setState(s => ({ ...s, isTracking: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setState(s => ({ ...s, position, error: null }));
      },
      (error) => {
        setState(s => ({ ...s, error, isTracking: false }));
        watchIdRef.current = null;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 12000,
      }
    );
  }, []);

  return {
    ...state,
    start,
    stop,
  };
}
