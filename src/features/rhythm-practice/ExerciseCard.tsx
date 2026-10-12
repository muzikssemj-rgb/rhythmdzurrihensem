import { Link } from 'react-router-dom';
import { Gauge, Lock, Play, Square, Volume2 } from 'lucide-react';
import type { Exercise } from '@/types';
import { meterLabel } from '@/lib/rhythm';
import { RhythmNotation } from '@/components/RhythmNotation';
import { LEVEL_STYLES, Stars } from '@/components/ui';

export function ExerciseCard({
  ex,
  to,
  best,
  stars,
  playing,
  onListen,
  getMusicTime,
  startLabel = 'Mula Latihan',
  locked = false,
}: {
  ex: Exercise;
  to: string;
  best?: number;
  stars?: number;
  playing: boolean;
  onListen: () => void;
  getMusicTime?: () => number | null;
  startLabel?: string;
  locked?: boolean;
}) {
  const st = LEVEL_STYLES[ex.level]!;
  return (
    <article className="card p-4 sm:p-5 flex flex-col gap-3 animate-rise">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[11px] font-extrabold tracking-wider ${st.text}`}>
            TAHAP {ex.level} {ex.custom && <span className="text-slate-400">• GURU</span>}
          </div>
          <h3 className="font-bold text-lg leading-tight">{ex.title}</h3>
          <p className="text-sm text-slate-400">{ex.focus}</p>
        </div>
        <div className="text-right shrink-0">
          {best != null ? (
            <>
              <Stars count={stars ?? 0} size={16} />
              <div className="text-xs text-slate-400 mt-0.5">Terbaik: {best}</div>
            </>
          ) : (
            <span className="chip text-slate-400">Baharu</span>
          )}
        </div>
      </header>
      <div className="rounded-2xl bg-ink-950/50 border border-white/5 px-2 py-1">
        <RhythmNotation exercise={ex} getMusicTime={playing ? getMusicTime : undefined} maxBarsPerRow={4} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="chip">Meter {meterLabel(ex.meter)}</span>
        <span className="chip">
          <Gauge size={12} /> {ex.tempoBpm} BPM
        </span>
        <span className="chip">{ex.bars.length} bar</span>
        <span className="chip">Lulus ≥ {ex.passMark}</span>
      </div>
      <div className="flex gap-2 mt-auto">
        <button className="btn-ghost flex-1" onClick={onListen} aria-pressed={playing}>
          {playing ? <Square size={18} /> : <Volume2 size={18} />} {playing ? 'Henti' : 'Dengar Contoh'}
        </button>
        {locked ? (
          <button className="btn-ghost flex-1" disabled aria-disabled title="Tahap ini masih terkunci">
            <Lock size={18} /> Terkunci
          </button>
        ) : (
          <Link to={to} className="btn-primary flex-1">
            <Play size={18} className="fill-current" /> {startLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
