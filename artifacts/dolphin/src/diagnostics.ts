/**
 * Lightweight diagnostic snapshot for error reporting.
 * Updated by DolphinApp on each significant state change.
 * Read by ErrorBoundary and the global error listener on crash.
 *
 * IMPORTANT: Do not store precise user coordinates here.
 */
export interface DiagnosticSnapshot {
  mapMode: string;
  trackingMode: string;
  hasPosition: boolean;
  headingFinite: boolean;
  headingApprox: string; // rounded to nearest 10° to avoid precision
  speedFinite: boolean;
  speedApprox: string;   // rounded to 1 decimal
  gpsQuality: string;
  isStale: boolean;
  mapInstanceCount: number; // how many times map was initialized
  overlayMode: string;
  capturedAt: number;
}

const DEFAULT: DiagnosticSnapshot = {
  mapMode: 'unknown',
  trackingMode: 'unknown',
  hasPosition: false,
  headingFinite: false,
  headingApprox: 'n/a',
  speedFinite: false,
  speedApprox: 'n/a',
  gpsQuality: 'none',
  isStale: false,
  mapInstanceCount: 0,
  overlayMode: 'none',
  capturedAt: 0,
};

let _current: DiagnosticSnapshot = { ...DEFAULT };

export function updateDiagnostics(patch: Partial<DiagnosticSnapshot>): void {
  _current = { ..._current, ...patch, capturedAt: Date.now() };
}

export function getDiagnostics(): DiagnosticSnapshot {
  return { ..._current };
}
