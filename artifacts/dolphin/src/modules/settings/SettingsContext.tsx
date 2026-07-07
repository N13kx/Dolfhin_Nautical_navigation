import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppSettings, ThemeMode } from './types';
import { DEFAULT_SETTINGS } from './types';
import { loadSettings, saveSettings } from './settingsStore';
import { applyTheme, installAutoThemeListener } from './theme';

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const themeRef = useRef<ThemeMode>(settings.theme);

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    themeRef.current = settings.theme;
    applyTheme(settings.theme);
  }, [settings.theme]);

  // In auto mode, re-apply when OS preference changes (no page reload)
  useEffect(() => {
    const cleanup = installAutoThemeListener(() => {
      if (themeRef.current === 'auto') applyTheme('auto');
    });
    return cleanup;
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next: AppSettings = {
        ...prev,
        ...patch,
        units: patch.units ? { ...prev.units, ...patch.units } : prev.units,
      };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
