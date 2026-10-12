import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Camera, CircleHelp, Cloud, HardDrive, Home, Music2, Settings, UserRound, WifiOff, GraduationCap, X } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { Avatar } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { PwaPrompt } from '@/components/PwaPrompt';

const NAV = [
  { to: '/', label: 'Utama', icon: Home, end: true },
  { to: '/latihan', label: 'Latihan', icon: Music2 },
  { to: '/ar', label: 'Mod AR', icon: Camera },
  { to: '/profil', label: 'Profil', icon: UserRound },
  { to: '/guru', label: 'Guru', icon: GraduationCap },
];

export function AppLayout() {
  const { profile, backend, online, toasts, dismissToast, storageOk } = useApp();
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-primary">
        Langkau ke kandungan
      </a>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-900/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2 shrink-0" aria-label="RHYTHM DZURRI AR — menu utama">
            <Logo size={36} />
            <span className="font-display font-bold tracking-wider text-sm sm:text-base leading-none">
              RHYTHM DZURRI <span className="text-gradient">AR</span>
            </span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Navigasi utama">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-xl text-sm font-bold transition ${isActive ? 'bg-white/10 text-cyan-200' : 'text-slate-300 hover:bg-white/5'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!online && (
              <span className="chip text-amber-200 border-amber-300/30" title="Tiada sambungan Internet">
                <WifiOff size={14} /> <span className="hidden sm:inline">Luar talian</span>
              </span>
            )}
            <span
              className={`chip hidden sm:inline-flex ${backend === 'supabase' ? 'text-emerald-200 border-emerald-300/30' : 'text-slate-300'}`}
              title={backend === 'supabase' ? 'Rekod disegerakkan ke pangkalan data awan' : 'Data disimpan dalam pelayar ini sahaja'}
            >
              {backend === 'supabase' ? <Cloud size={14} /> : <HardDrive size={14} />}
              {backend === 'supabase' ? 'Awan' : 'Mod Tempatan'}
            </span>
            <NavLink to="/bantuan" className="btn-ghost !px-2.5 !min-h-10 hidden sm:inline-flex" aria-label="Bantuan">
              <CircleHelp size={20} />
            </NavLink>
            <NavLink to="/tetapan" className="btn-ghost !px-2.5 !min-h-10" aria-label="Tetapan">
              <Settings size={20} />
            </NavLink>
            <NavLink to="/profil" className="flex items-center gap-2 rounded-2xl pl-1 pr-3 py-1 bg-white/5 border border-white/10 hover:bg-white/10" aria-label={`Profil ${profile.displayName}`}>
              <Avatar code={profile.avatar} size={32} />
              <span className="hidden sm:block text-sm font-bold max-w-28 truncate">{profile.displayName}</span>
            </NavLink>
          </div>
        </div>
      </header>

      {!storageOk && (
        <div className="mx-auto max-w-6xl px-4 pt-3 w-full">
          <div className="rounded-xl bg-amber-400/10 border border-amber-300/30 text-amber-100 text-sm px-4 py-2">
            Storan pelayar disekat (mod peribadi?). Kemajuan tidak akan disimpan selepas halaman ditutup.
          </div>
        </div>
      )}

      <main id="main" className="flex-1 mx-auto w-full max-w-6xl px-4 pt-5 pb-28 md:pb-10">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-28 md:pb-6 -mt-20 md:mt-0 text-center text-xs text-slate-500">
        copyright@dzurrihensem2025
      </footer>

      {/* Navigasi bawah (telefon) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-ink-900/90 backdrop-blur-lg safe-bottom" aria-label="Navigasi utama">
        <div className="grid grid-cols-5 pt-1.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-bold ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}
            >
              <n.icon size={22} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="fixed z-50 bottom-24 md:bottom-6 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto card px-4 py-3 text-sm font-bold flex items-center gap-3 animate-rise max-w-sm ${
              t.tone === 'success' ? 'border-emerald-300/40' : t.tone === 'error' ? 'border-rose-400/40' : ''
            }`}
          >
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismissToast(t.id)} aria-label="Tutup notifikasi" className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <PwaPrompt />
    </div>
  );
}
