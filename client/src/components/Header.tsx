import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, BarChart2, Pencil, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import ClubSelector from './ClubSelector';
import { useAuth } from '@/context/AuthContext';
import { useClub } from '@/context/ClubContext';
import { useMembership } from '@/context/MembershipContext';

interface HeaderProps {
  onRenameClub: () => void;
  onShowProfile: () => void;
}

export default function Header({ onRenameClub, onShowProfile }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { clubs, selectedClubId } = useClub();
  const { currentMembership } = useMembership();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isOwner = user?.role === 'owner';
  const selectedClub = clubs.find((c) => c.id === selectedClubId);
  const clubName = selectedClub?.name ?? 'Sin club';
  const displayName = currentMembership?.displayName ?? user?.name ?? '';
  const roleLabel = isOwner ? 'Dueño' : 'Empleado';

  function closeSheetThen(fn: () => void) {
    setSheetOpen(false);
    // Small delay so the sheet closes before the modal opens
    setTimeout(fn, 150);
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">

      {/* ── Desktop (md and up) ─────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between px-6 h-14 gap-4">

        {/* Left: club name + rename */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <h1 className="text-lg font-bold text-indigo-700 tracking-tight truncate max-w-[220px]">
            {clubName}
          </h1>
          {isOwner && selectedClub && (
            <button
              onClick={onRenameClub}
              title="Editar nombre del club"
              className="p-1 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Center: ClubSelector (owner only) */}
        <div className="flex-1 flex justify-center">
          {isOwner && <ClubSelector />}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-indigo-600 gap-1.5"
            >
              <BarChart2 className="w-4 h-4" />
              Ingresos
            </Button>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/cash')}
              className="text-gray-500 hover:text-indigo-600 gap-1.5"
            >
              <Wallet className="w-4 h-4" />
              Caja
            </Button>
          )}

          {/* User badge */}
          {displayName && (
            <button
              onClick={currentMembership ? onShowProfile : undefined}
              title={currentMembership ? 'Editar perfil' : undefined}
              className={[
                'text-xs px-2.5 py-1 rounded-full font-medium border transition-colors',
                isOwner
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
                !currentMembership ? 'cursor-default' : 'cursor-pointer',
              ].join(' ')}
            >
              {displayName}{' '}
              <span className="opacity-60">({roleLabel})</span>
            </button>
          )}

          {/* Logout */}
          <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
            <LogOut className="w-4 h-4" />
            Salir
          </Button>
        </div>
      </div>

      {/* ── Mobile (below md) ───────────────────────────────────────────────── */}
      <div className="flex md:hidden items-center justify-between px-4 h-14">

        {/* Left: hamburger → Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>

          <SheetContent side="left">
            {/* Sheet header: club name */}
            <SheetHeader>
              <SheetTitle className="truncate pr-8">{clubName}</SheetTitle>
              {isOwner && selectedClub && (
                <button
                  onClick={() => closeSheetThen(onRenameClub)}
                  className="self-start flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Renombrar club
                </button>
              )}
            </SheetHeader>

            <div className="flex flex-col px-6 pb-6 gap-5 overflow-y-auto flex-1">

              {/* ClubSelector (owner only) */}
              {isOwner && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                    Club activo
                  </p>
                  <ClubSelector />
                </div>
              )}

              <hr className="border-gray-100" />

              {/* Navigation */}
              <nav className="flex flex-col gap-1">
                {isOwner && (
                  <SheetClose asChild>
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="flex items-center gap-3 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2.5 rounded-lg transition-colors text-left"
                    >
                      <BarChart2 className="w-4 h-4 shrink-0" />
                      Ingresos
                    </button>
                  </SheetClose>
                )}
                {isOwner && (
                  <SheetClose asChild>
                    <button
                      onClick={() => navigate('/cash')}
                      className="flex items-center gap-3 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2.5 rounded-lg transition-colors text-left"
                    >
                      <Wallet className="w-4 h-4 shrink-0" />
                      Caja
                    </button>
                  </SheetClose>
                )}
              </nav>

              <hr className="border-gray-100" />

              {/* User profile */}
              {displayName && (
                <button
                  onClick={currentMembership ? () => closeSheetThen(onShowProfile) : undefined}
                  className={[
                    'flex items-center gap-3 text-left px-3 py-2 rounded-lg transition-colors',
                    currentMembership ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      isOwner ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600',
                    ].join(' ')}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400">{roleLabel}</p>
                  </div>
                </button>
              )}

              {/* Logout */}
              <button
                onClick={() => { setSheetOpen(false); logout(); }}
                className="flex items-center gap-3 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2.5 rounded-lg transition-colors text-left"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Center: club name */}
        <h1 className="text-base font-bold text-indigo-700 truncate max-w-[160px] absolute left-1/2 -translate-x-1/2">
          {clubName}
        </h1>

        {/* Right: logout icon */}
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="text-gray-400 hover:text-red-500 shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span className="sr-only">Cerrar sesión</span>
        </Button>
      </div>
    </header>
  );
}
