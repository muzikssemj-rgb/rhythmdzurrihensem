import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bird,
  Cat,
  Crown,
  Drum,
  Guitar,
  Headphones,
  Lock,
  MicVocal,
  Music,
  Piano,
  Rocket,
  Star,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const AVATARS: { code: string; icon: LucideIcon; label: string; from: string; to: string }[] = [
  { code: 'drum', icon: Drum, label: 'Dram', from: 'from-cyan-400', to: 'to-blue-600' },
  { code: 'guitar', icon: Guitar, label: 'Gitar', from: 'from-violet-400', to: 'to-fuchsia-600' },
  { code: 'piano', icon: Piano, label: 'Piano', from: 'from-amber-300', to: 'to-orange-500' },
  { code: 'mic', icon: MicVocal, label: 'Penyanyi', from: 'from-pink-400', to: 'to-rose-600' },
  { code: 'music', icon: Music, label: 'Not', from: 'from-teal-300', to: 'to-emerald-600' },
  { code: 'headphones', icon: Headphones, label: 'DJ', from: 'from-sky-300', to: 'to-indigo-600' },
  { code: 'rocket', icon: Rocket, label: 'Roket', from: 'from-orange-300', to: 'to-red-500' },
  { code: 'cat', icon: Cat, label: 'Kucing', from: 'from-lime-300', to: 'to-green-600' },
  { code: 'bird', icon: Bird, label: 'Burung', from: 'from-cyan-200', to: 'to-teal-600' },
  { code: 'star', icon: Star, label: 'Bintang', from: 'from-yellow-200', to: 'to-amber-500' },
  { code: 'zap', icon: Zap, label: 'Kilat', from: 'from-violet-300', to: 'to-blue-600' },
  { code: 'crown', icon: Crown, label: 'Mahkota', from: 'from-gold-300', to: 'to-gold-500' },
];

export function Avatar({ code, size = 40, className = '' }: { code: string; size?: number; className?: string }) {
  const a = AVATARS.find((x) => x.code === code) ?? AVATARS[0]!;
  const Icon = a.icon;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${a.from} ${a.to} text-ink-950 shadow-md shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Avatar ${a.label}`}
      role="img"
    >
      <Icon size={size * 0.55} strokeWidth={2.2} />
    </span>
  );
}

export function PageHeader({ title, subtitle, back = true, right, backTo }: { title: ReactNode; subtitle?: ReactNode; back?: boolean; right?: ReactNode; backTo?: string }) {
  const nav = useNavigate();
  return (
    <div className="flex items-center gap-3 mb-5">
      {back && (
        <button className="btn-ghost !px-3 !min-h-11" onClick={() => (backTo ? nav(backTo) : nav(-1))} aria-label="Kembali">
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm sm:text-base">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stars({ count, max = 3, size = 22, animate = false }: { count: number; max?: number; size?: number; animate?: boolean }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${count} daripada ${max} bintang`} role="img">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={`${i < count ? 'fill-gold-400 text-gold-400 drop-shadow-[0_0_6px_rgba(252,211,77,0.6)]' : 'text-slate-600'} ${animate && i < count ? 'animate-pop' : ''}`}
          style={animate ? { animationDelay: `${0.25 + i * 0.2}s` } : undefined}
        />
      ))}
    </span>
  );
}

export function ProgressBar({ value, max = 100, className = '', color = 'from-cyan-400 to-violet-500', label }: { value: number; max?: number; className?: string; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`h-2.5 rounded-full bg-white/10 overflow-hidden ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatTile({ icon, label, value, accent = 'text-cyan-300' }: { icon: ReactNode; label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="card p-4 flex items-center gap-3 min-w-0">
      <div className={`shrink-0 rounded-xl bg-white/5 p-2.5 ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] leading-tight text-slate-400 font-bold uppercase tracking-wide line-clamp-2">{label}</div>
        <div className="text-xl font-extrabold font-display truncate">{value}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/75 backdrop-blur-sm p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`card w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92dvh] overflow-y-auto rounded-b-none sm:rounded-3xl p-5 sm:p-6 animate-rise outline-none safe-bottom`}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button className="btn-ghost !px-3 !min-h-10" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LockedBadge({ text }: { text: string }) {
  return (
    <span className="chip text-slate-300">
      <Lock size={12} /> {text}
    </span>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode; icon?: ReactNode }) {
  const cls = {
    info: 'bg-cyan-400/10 border-cyan-300/25 text-cyan-100',
    warn: 'bg-amber-400/10 border-amber-300/30 text-amber-100',
    error: 'bg-rose-500/10 border-rose-400/30 text-rose-100',
    success: 'bg-emerald-400/10 border-emerald-300/30 text-emerald-100',
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm flex gap-3 items-start ${cls}`} role={tone === 'error' ? 'alert' : 'status'}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const LEVEL_STYLES: Record<number, { grad: string; text: string; ring: string }> = {
  1: { grad: 'from-cyan-400 to-sky-600', text: 'text-cyan-300', ring: 'ring-cyan-400/50' },
  2: { grad: 'from-teal-300 to-emerald-600', text: 'text-teal-300', ring: 'ring-teal-400/50' },
  3: { grad: 'from-violet-400 to-fuchsia-600', text: 'text-violet-300', ring: 'ring-violet-400/50' },
  4: { grad: 'from-gold-300 to-gold-500', text: 'text-gold-300', ring: 'ring-amber-400/50' },
};
