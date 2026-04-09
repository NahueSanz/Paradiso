import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as api from '../api';
import type { Club } from '../types';
import { useAuth } from './AuthContext';

const SELECTED_KEY = 'pp_selected_club';

interface ClubContextValue {
  clubs: Club[];
  selectedClubId: number | null;
  loadingClubs: boolean;
  setSelectedClubId: (id: number) => void;
  refreshClubs: () => Promise<void>;
}

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [selectedClubId, setSelectedClubIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(SELECTED_KEY);
    return raw ? Number(raw) : null;
  });

  function setSelectedClubId(id: number) {
    setSelectedClubIdState(id);
    localStorage.setItem(SELECTED_KEY, String(id));
  }

  const refreshClubs = useCallback(async () => {
    if (!token) return;
    setLoadingClubs(true);
    try {
      const data = await api.getClubs();
      setClubs(data);
      // Auto-select: if current selection is invalid or missing, pick first club
      setSelectedClubIdState((prev) => {
        const validIds = new Set(data.map((c) => c.id));
        if (prev !== null && validIds.has(prev)) return prev;
        if (data.length > 0) {
          const first = data[0].id;
          localStorage.setItem(SELECTED_KEY, String(first));
          return first;
        }
        return null;
      });
    } finally {
      setLoadingClubs(false);
    }
  }, [token]);

  useEffect(() => {
    refreshClubs();
  }, [refreshClubs]);

  return (
    <ClubContext.Provider value={{ clubs, selectedClubId, loadingClubs, setSelectedClubId, refreshClubs }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub debe usarse dentro de ClubProvider');
  return ctx;
}
