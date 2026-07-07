import type { VesselProfile } from './types';

const STORAGE_KEY = 'dolphin:vessel:v1';
const SCHEMA_VERSION = 1;

interface Stored {
  schemaVersion: number;
  data: VesselProfile;
}

/** Returns a list of validation errors, or empty array if valid */
export function validateVesselProfile(
  profile: Partial<VesselProfile>,
): string[] {
  const errors: string[] = [];

  if (profile.name !== undefined && profile.name.trim().length === 0) {
    errors.push('Vaatnaam mag niet leeg zijn.');
  }

  type NumField = [keyof VesselProfile, number, number, string];
  const numFields: NumField[] = [
    ['lengthMeters', 0.5, 350, 'Lengte'],
    ['beamMeters', 0.5, 100, 'Breedte'],
    ['draftMeters', 0.01, 30, 'Diepgang'],
    ['airDraftMeters', 0, 200, 'Doorvaarthoogte'],
    ['cruisingSpeedKnots', 0.1, 100, 'Kruissnelheid'],
    ['maxSpeedKnots', 0.1, 150, 'Maximumsnelheid'],
  ];

  for (const [field, min, max, label] of numFields) {
    const raw = profile[field];
    if (raw !== undefined) {
      const v = Number(raw);
      if (!Number.isFinite(v) || v < min || v > max) {
        errors.push(`${label}: ongeldige waarde (${min}–${max}).`);
      }
    }
  }

  const cs = Number(profile.cruisingSpeedKnots);
  const ms = Number(profile.maxSpeedKnots);
  if (
    profile.maxSpeedKnots !== undefined &&
    profile.cruisingSpeedKnots !== undefined &&
    Number.isFinite(ms) &&
    Number.isFinite(cs) &&
    ms < cs
  ) {
    errors.push('Maximumsnelheid moet groter zijn dan of gelijk aan de kruissnelheid.');
  }

  return errors;
}

const VALID_VESSEL_KINDS = ['sail', 'motor', 'rib', 'barge', 'other'] as const;

/** Basic shape check — ensures stored data is a usable VesselProfile */
function isValidVesselShape(v: unknown): v is VesselProfile {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0) return false;
  if (typeof p.name !== 'string') return false;
  if (!VALID_VESSEL_KINDS.includes(p.kind as never)) return false;
  // Optional numeric fields: must be finite if present
  const numFields = [
    'lengthMeters', 'beamMeters', 'draftMeters',
    'airDraftMeters', 'cruisingSpeedKnots', 'maxSpeedKnots',
  ] as const;
  for (const field of numFields) {
    if (p[field] !== undefined && !Number.isFinite(Number(p[field]))) return false;
  }
  return true;
}

export function loadVesselProfile(): VesselProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: Stored = JSON.parse(raw);
    if (stored.schemaVersion !== SCHEMA_VERSION) {
      return null;
    }
    if (!isValidVesselShape(stored.data)) {
      console.warn('[vesselProfile] Discarding corrupt stored vessel profile');
      return null;
    }
    return stored.data;
  } catch {
    return null;
  }
}

export function saveVesselProfile(profile: VesselProfile): void {
  try {
    const stored: Stored = { schemaVersion: SCHEMA_VERSION, data: profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Fail silently
  }
}

export function clearVesselProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently
  }
}
