import type { AppSettings } from './types';
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION } from './types';

const STORAGE_KEY = 'dolphin:settings:v1';

interface Stored {
  schemaVersion: number;
  data: AppSettings;
}

function isValid(v: unknown): v is AppSettings {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<AppSettings>;

  if (s.theme !== 'auto' && s.theme !== 'light' && s.theme !== 'dark') return false;
  if (
    s.defaultMapMode !== 'Dolphin' &&
    s.defaultMapMode !== 'Satellite' &&
    s.defaultMapMode !== 'Hybrid'
  ) return false;
  if (s.orientation !== 'northUp' && s.orientation !== 'courseUp') return false;

  const u = s.units as Record<string, unknown> | undefined;
  if (!u || typeof u !== 'object') return false;
  if (u.speed !== 'knots' && u.speed !== 'kmh') return false;
  if (u.depth !== 'meters' && u.depth !== 'feet' && u.depth !== 'fathoms') return false;
  if (u.distance !== 'nautical' && u.distance !== 'metric') return false;

  return true;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, units: { ...DEFAULT_SETTINGS.units } };
    const stored: Stored = JSON.parse(raw);
    if (stored.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
      // Schema version mismatch — use defaults (future: migrate here)
      return { ...DEFAULT_SETTINGS, units: { ...DEFAULT_SETTINGS.units } };
    }
    if (!isValid(stored.data)) {
      return { ...DEFAULT_SETTINGS, units: { ...DEFAULT_SETTINGS.units } };
    }
    // Deep merge with defaults so future new fields are always present
    return {
      ...DEFAULT_SETTINGS,
      ...stored.data,
      units: { ...DEFAULT_SETTINGS.units, ...stored.data.units },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, units: { ...DEFAULT_SETTINGS.units } };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    const stored: Stored = { schemaVersion: SETTINGS_SCHEMA_VERSION, data: settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Fail silently — storage may be unavailable (private mode, quota exceeded)
  }
}
