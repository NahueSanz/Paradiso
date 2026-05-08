import { useEffect, useState } from 'react';
import { useClub } from '../context/ClubContext';
import * as api from '../api';
import type { ClubMember } from '../api';

const ROLE_LABEL: Record<string, string> = {
  owner:    'Dueño',
  employee: 'Empleado',
};

export default function TeamPage() {
  const { selectedClubId } = useClub();
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!selectedClubId) { setMembers([]); return; }
    setLoading(true);
    setError('');
    api.getClubMembers()
      .then(setMembers)
      .catch((e: any) => setError(e.message ?? 'Error al cargar el equipo'))
      .finally(() => setLoading(false));
  }, [selectedClubId]);

  return (
    <div className="bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">Mi equipo</h1>
        <p className="text-xs text-muted-foreground">Usuarios con acceso a este club</p>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        {!selectedClubId && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="text-lg font-semibold text-foreground">Seleccioná un club para ver el equipo</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {selectedClubId && (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {loading ? '—' : `${members.length} ${members.length === 1 ? 'integrante' : 'integrantes'}`}
              </h2>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">Cargando…</div>
            ) : members.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">No hay integrantes en este club.</div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-4 px-6 py-4">
                    <div className={[
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                      m.role === 'owner'
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                    ].join(' ')}>
                      {(m.name ?? m.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name ?? m.email}</p>
                      {m.name && m.name !== m.email && (
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      )}
                    </div>
                    <span className={[
                      'text-xs font-semibold px-2.5 py-1 rounded-full',
                      m.role === 'owner'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                    ].join(' ')}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
