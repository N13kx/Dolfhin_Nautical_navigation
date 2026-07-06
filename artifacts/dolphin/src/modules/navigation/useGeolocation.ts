import { useState, useEffect, useCallback, useRef } from 'react';
import type { GpsPosition, GpsError, GpsQuality } from './types';
import {
  getGpsQuality,
  isPositionStale,
  STALE_CHECK_INTERVAL_MS,
} from './gpsUtils';

export interface GeolocationState {
  position: GpsPosition | null;
  quality: GpsQuality;
  error: GpsError | null;
  isTracking: boolean;
}

/**
 * Lifecycle-safe GPS hook wrapping browser watchPosition.
 *
 * Guarantees:
 *  - No duplicate watchers (guarded by watchIdRef)
 *  - Watcher cleared on unmount and on stop()
 *  - StrictMode safe (start() is idempotent while watcher is active)
 *  - Staleness detection via a periodic interval check
 *  - Typed error codes (permission_denied | unavailable | timeout | unsupported | unknown)
 */
export function useGeolocation(): GeolocationState & {
  start: () => void;
  stop: () => void;
} {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    quality: 'none',
    error: null,
    isTracking: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current !== null) {
      clearInterval(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  const startStaleTimer = useCallback(() => {
    if (staleTimerRef.current !== null) return;
    staleTimerRef.current = setInterval(() => {
      setState(s => {
        if (!s.position) return s;
        const stale = isPositionStale(s.position.timestamp);
        if (stale === s.position.isStale) return s; // avoid re-render when unchanged
        return { ...s, position: { ...s.position, isStale: stale } };
      });
    }, STALE_CHECK_INTERVAL_MS);
  }, []);

  // Always clean up watcher and timer on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      clearStaleTimer();
    };
  }, [clearStaleTimer]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    clearStaleTimer();
    setState(s => ({ ...s, isTracking: false }));
  }, [clearStaleTimer]);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState(s => ({
        ...s,
        error: {
          code: 'unsupported',
          message: 'Locatiebepaling wordt niet ondersteund door deze browser.',
        },
      }));
      return;
    }

    // Guard against duplicate starts (StrictMode double-invoke safe)
    if (watchIdRef.current !== null) return;

    setState(s => ({ ...s, isTracking: true, error: null }));
    startStaleTimer();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const gpsPos: GpsPosition = {
          latitude,
          longitude,
          accuracy,
          heading: typeof heading === 'number' ? heading : null,
          speed: typeof speed === 'number' ? speed : null,
          timestamp: pos.timestamp,
          isStale: false,
        };
        setState(s => ({
          ...s,
          position: gpsPos,
          quality: getGpsQuality(accuracy),
          error: null,
        }));
      },
      (err) => {
        let code: GpsError['code'];
        if (err.code === err.PERMISSION_DENIED) code = 'permission_denied';
        else if (err.code === err.POSITION_UNAVAILABLE) code = 'unavailable';
        else if (err.code === err.TIMEOUT) code = 'timeout';
        else code = 'unknown';

        setState(s => ({
          ...s,
          error: { code, message: err.message },
          isTracking: false,
        }));
        watchIdRef.current = null;
        clearStaleTimer();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 12000,
      }
    );
  }, [startStaleTimer, clearStaleTimer]);

  return { ...state, start, stop };
}
