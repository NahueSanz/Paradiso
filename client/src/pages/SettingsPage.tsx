import { useEffect, useState } from 'react';
import * as api from '../api';
import type { DaySchedule } from '../api';
import { useClub } from '../context/ClubContext';

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
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Configuración</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Ajustes del club
      </p>

      {/* Opening hours section */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Horarios del club
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Horario predeterminado por día de la semana. Podés sobreescribir días individuales desde Turnos.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-10 text-sm">Cargando…</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {schedule.map((day, idx) => (
              <div
                key={day.dayOfWeek}
                className="flex items-center gap-3 px-5 py-3"
              >
                <span className="w-24 text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
                  {DAY_NAMES[day.dayOfWeek]}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Apertura</span>
                    <input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => updateDay(idx, 'openTime', e.target.value)}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm
                                 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100
                                 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <span className="text-slate-300 dark:text-slate-600">–</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Cierre</span>
                    <input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => updateDay(idx, 'closeTime', e.target.value)}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm
                                 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100
                                 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
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
