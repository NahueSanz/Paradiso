import { useEffect, useState } from 'react';
import * as api from '../api';
import type { DaySchedule } from '../api';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const FALLBACK_OPEN  = '09:00';
const FALLBACK_CLOSE = '01:00';

function emptySchedule(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    openTime:  FALLBACK_OPEN,
    closeTime: FALLBACK_CLOSE,
  }));
}

export default function SettingsPage() {
  const { selectedClubId } = useClub();
  const { user, setUser } = useAuth();

  // ── Profile state ──
  const [profileName,   setProfileName]   = useState(user?.name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError,  setProfileError]  = useState('');

  // ── Schedule state ──
  const [schedule, setSchedule] = useState<DaySchedule[]>(emptySchedule());
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!selectedClubId) return;
    setLoading(true);
    api.getWeeklyDefaults(selectedClubId)
      .then((data) => {
        setSchedule(
          data.map((row, i) => row ?? { dayOfWeek: i, openTime: FALLBACK_OPEN, closeTime: FALLBACK_CLOSE }),
        );
      })
      .catch(() => setSchedule(emptySchedule()))
      .finally(() => setLoading(false));
  }, [selectedClubId]);

  function updateDay(idx: number, field: 'openTime' | 'closeTime', value: string) {
    setSchedule((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = profileName.trim();
    if (trimmed.length < 2) { setProfileError('El nombre debe tener al menos 2 caracteres'); return; }
    if (trimmed.length > 50) { setProfileError('El nombre no puede superar los 50 caracteres'); return; }
    setSavingProfile(true);
    setProfileError('');
    try {
      const updated = await api.updateMyProfile({ name: trimmed });
      setUser({ ...user!, name: updated.name });
      setProfileName(updated.name);
      showToast('Nombre actualizado correctamente', true);
    } catch (err: any) {
      setProfileError(err.message ?? 'Error al guardar el nombre');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSave() {
    if (!selectedClubId) return;
    setSaving(true);
    try {
      await api.updateDefaultHours(selectedClubId, schedule);
      showToast('Horarios guardados correctamente', true);
    } catch {
      showToast('Error al guardar los horarios', false);
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 className="text-xl font-bold text-foreground mb-1">Configuración</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Ajustes del club
      </p>

      {/* Profile section */}
      <section className="bg-card rounded-xl border border-border overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Mi perfil</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tu nombre visible en el chat y el equipo.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => { setProfileName(e.target.value); setProfileError(''); }}
              placeholder="Ej: Juan García"
              maxLength={50}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm
                         bg-background text-foreground
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {profileError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{profileError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingProfile || !profileName.trim() || profileName.trim() === (user?.name ?? '')}
            className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium
                       hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {savingProfile ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </form>
      </section>

      {/* Opening hours section */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Horarios del club
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Horario predeterminado por día de la semana. Podés sobreescribir días individuales desde Turnos.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-10 text-sm">Cargando…</p>
        ) : (
          <div className="divide-y divide-border">
            {schedule.map((day, idx) => (
              <div
                key={day.dayOfWeek}
                className="flex items-center gap-3 px-5 py-3"
              >
                <span className="w-24 text-sm font-medium text-foreground shrink-0">
                  {DAY_NAMES[day.dayOfWeek]}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Apertura</span>
                    <input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => updateDay(idx, 'openTime', e.target.value)}
                      className="border border-input rounded-lg px-2 py-1 text-sm
                                 bg-background text-foreground
                                 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <span className="text-muted-foreground">–</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Cierre</span>
                    <input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => updateDay(idx, 'closeTime', e.target.value)}
                      className="border border-input rounded-lg px-2 py-1 text-sm
                                 bg-background text-foreground
                                 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-4 border-t border-border bg-muted/50">
          <p className="text-[11px] text-muted-foreground mb-3">
            Si el cierre es menor a la apertura se interpreta como el día siguiente (ej: 09:00 → 01:00).
          </p>
          <button
            onClick={handleSave}
            disabled={saving || loading || !selectedClubId}
            className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium
                       hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar horarios'}
          </button>
        </div>
      </section>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg
            text-sm font-medium pointer-events-none
            ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {toast.ok ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
