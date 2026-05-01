import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as api from '../api';
import type { Membership } from '../types';
import { useAuth } from './AuthContext';
import { useClub } from './ClubContext';

interface MembershipContextValue {
  currentMembership: Membership | null;
  loadingMembership: boolean;
  updateDisplayName: (name: string) => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { selectedClubId } = useClub();

  const [currentMembership, setCurrentMembership] = useState<Membership | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);

  const refreshMembership = useCallback(async () => {
    if (!token || !selectedClubId) {
      setCurrentMembership(null);
      return;
    }
    setLoadingMembership(true);
    try {
      const membership = await api.getMembership(selectedClubId);
      setCurrentMembership(membership);
    } catch {
      setCurrentMembership(null);
    } finally {
      setLoadingMembership(false);
    }
  }, [token, selectedClubId]);

  useEffect(() => {
    refreshMembership();
  }, [refreshMembership]);

  async function updateDisplayName(name: string) {
    if (!currentMembership) return;
    const updated = await api.updateMembership(currentMembership.id, { displayName: name });
    setCurrentMembership(updated);
  }

  return (
    <MembershipContext.Provider value={{ currentMembership, loadingMembership, updateDisplayName, refreshMembership }}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership(): MembershipContextValue {
  const ctx = useContext(MembershipContext);
  if (!ctx) throw new Error('useMembership debe usarse dentro de MembershipProvider');
  return ctx;
}
