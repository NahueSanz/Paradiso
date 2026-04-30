import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Menu, LogOut, BarChart2, Wallet, Package, ShoppingCart, Pencil, Calendar, Moon, Sun, Settings,
} from 'lucide-react';
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

interface AppLayoutProps {
  children: React.ReactNode;
  onRenameClub?: () => void;
  onShowProfile?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  ownerOnly: boolean;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Turnos',           Icon: Calendar,     ownerOnly: false, end: true },
  { to: '/dashboard', label: 'Ingresos',         Icon: BarChart2,    ownerOnly: true },
  { to: '/cash',      label: 'Caja',             Icon: Wallet,       ownerOnly: true },
  { to: '/sell',      label: 'Vender productos', Icon: ShoppingCart, ownerOnly: true },
  { to: '/stock',     label: 'Stock',            Icon: Package,      ownerOnly: true },
  { to: '/settings',  label: 'Configuración',    Icon: Settings,     ownerOnly: true },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
    isActive
      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100',
  ].join(' ');
}

export default function AppLayout({ children, onRenameClub, onShowProfile }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { clubs, selectedClubId } = useClub();
  const { currentMembership } = useMembership();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const isOwner = user?.role === 'owner';
  const selectedClub = clubs.find((c) => c.id === selectedClubId);
  const clubName = selectedClub?.name ?? 'Sin club';
  const displayName = currentMembership?.displayName ?? user?.name ?? '';
  const roleLabel = isOwner ? 'Dueño' : 'Empleado';

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="flex h-screen bg-background">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border z-40">

        {/* Club name */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <button
            onClick={() => navigate('/')}
            className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tracking-tight truncate block hover:opacity-80 transition-opacity text-left w-full"
            title="Ir al calendario"
          >
            {clubName}
          </button>
          {isOwner && selectedClub && onRenameClub && (
            <button
              onClick={onRenameClub}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500 mt-0.5 transition-colors"
            >
              <Pencil className="w-2.5 h-2.5" />
              Renombrar
            </button>
          )}
        </div>

        {/* Club selector (owner only) */}
        {isOwner && (
          <div className="px-3 pt-3 pb-1">
            <ClubSelector />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto">
          {visibleItems.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="px-3 pb-4 border-t border-sidebar-border pt-3 flex flex-col gap-1">

          {/* Dark mode toggle */}
          <button
            onClick={() => setDark((d) => !d)}
            title={dark ? 'Modo claro' : 'Modo oscuro'}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {dark ? 'Modo claro' : 'Modo oscuro'}
          </button>

          {/* User info */}
          {displayName && (
            <button
              onClick={currentMembership && onShowProfile ? onShowProfile : undefined}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                currentMembership && onShowProfile
                  ? 'hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                  : 'cursor-default',
              ].join(' ')}
            >
              <div className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                isOwner
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
              ].join(' ')}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{roleLabel}</p>
              </div>
            </button>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Mobile header ── */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-sidebar border-b border-sidebar-border shrink-0">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="bg-sidebar border-sidebar-border">
              <SheetHeader>
                <SheetTitle className="truncate pr-8 dark:text-slate-100">{clubName}</SheetTitle>
                {isOwner && selectedClub && onRenameClub && (
                  <button
                    onClick={() => { setSheetOpen(false); setTimeout(onRenameClub, 150); }}
                    className="self-start flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
                  >
                    <Pencil className="w-3 h-3" />
                    Renombrar club
                  </button>
                )}
              </SheetHeader>

              <div className="flex flex-col px-6 pb-6 gap-5 overflow-y-auto flex-1">
                {isOwner && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Club activo</p>
                    <ClubSelector />
                  </div>
                )}

                <hr className="border-sidebar-border" />

                <nav className="flex flex-col gap-1">
                  <SheetClose asChild>
                    <div className="flex flex-col gap-1">
                      {visibleItems.map(({ to, label, Icon, end }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={() => setSheetOpen(false)}
                          className={navLinkClass}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  </SheetClose>
                </nav>

                <hr className="border-sidebar-border" />

                <div className="flex items-center justify-between px-1">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Modo oscuro</span>
                  <button
                    onClick={() => setDark((d) => !d)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                </div>

                {displayName && (
                  <button
                    onClick={
                      currentMembership && onShowProfile
                        ? () => { setSheetOpen(false); setTimeout(onShowProfile, 150); }
                        : undefined
                    }
                    className={[
                      'flex items-center gap-3 text-left px-3 py-2 rounded-lg transition-colors',
                      currentMembership && onShowProfile
                        ? 'hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                        : 'cursor-default',
                    ].join(' ')}
                  >
                    <div className={[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      isOwner
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                    ].join(' ')}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{roleLabel}</p>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => { setSheetOpen(false); logout(); }}
                  className="flex items-center gap-3 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2.5 rounded-lg transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <h1 className="text-base font-bold text-indigo-700 dark:text-indigo-400 truncate max-w-[160px] absolute left-1/2 -translate-x-1/2">
            {clubName}
          </h1>

          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="text-slate-400 hover:text-red-500 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
