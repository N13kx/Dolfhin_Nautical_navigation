import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { VesselProfile } from './types';
import {
  loadVesselProfile,
  saveVesselProfile,
  clearVesselProfile,
} from './vesselProfile';

interface VesselProfileContextValue {
  profile: VesselProfile | null;
  setProfile: (profile: VesselProfile) => void;
  clearProfile: () => void;
}

const VesselProfileContext = createContext<VesselProfileContextValue>({
  profile: null,
  setProfile: () => {},
  clearProfile: () => {},
});

export function VesselProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<VesselProfile | null>(
    () => loadVesselProfile(),
  );

  const setProfile = useCallback((p: VesselProfile) => {
    saveVesselProfile(p);
    setProfileState(p);
  }, []);

  const clearProfile = useCallback(() => {
    clearVesselProfile();
    setProfileState(null);
  }, []);

  return (
    <VesselProfileContext.Provider value={{ profile, setProfile, clearProfile }}>
      {children}
    </VesselProfileContext.Provider>
  );
}

export function useVesselProfile(): VesselProfileContextValue {
  return useContext(VesselProfileContext);
}
