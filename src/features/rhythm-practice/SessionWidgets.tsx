import { useEffect, useRef, useState } from 'react';
import { Hand, LogOut, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { SessionSnapshot } from './sessionEngine';
import type { LiveJudgement } from './usePracticeSession';

/** Penunjuk detik visual + kiraan masuk — dibaca daripada jam audio dalam rAF. */
export function BeatIndicator({ getSnapshot, beatsPerBar, large = false }: { getSnapshot: () => SessionSnapshot | null; beatsPerBar: number; large?: boolean }) {
  const [snap, setSnap] = useState<{ beat: number; countIn: number; phase: string; progress: number; beatIndex: number }>({ beat: -1, countIn: 0, phase: 'idle', progress: 0, beatIndex: -99 });
  const last = useRef('');
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = getSnapshot();
      if (!s) return;
      const key = `${s.beatIndex}|${s.phase}|${Math.round(s.progress * 100)}`;
      if (key === last.current) return;
      last.current = key;
      setSnap({ beat: s.beatInBar, countIn: s.countInBeatsLeft, phase: s.phase, progress: s.progress, beatIndex: s.beatIndex });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getSnapshot]);

  const counting = snap.phase === 'countin';
  const size = large ? 'size-6 sm:size-7' : 'size-4 sm:size-5';
  return (
    <div className="flex flex-col items-center gap-2" aria-live="off">
      <div className="h-12 flex items-center justify-center">
        {counting && snap.countIn > 0 ? (
          <span key={snap.countIn} className="font-display font-bold text-4xl sm:text-5xl text-gradient animate-pop">
            {snap.countIn}
          </span>
        ) : snap.phase === 'playing' ? (
          <span className="font-display font-bold text-lg text-cyan-200 tracking-widest">TEPUK!</span>
        ) : snap.phase === 'paused' ? (
          <span className="font-display font-bold text-lg text-amber-200 tracking-widest">DIJEDA</span>
        ) : null}
      </div>
      <div className="flex gap-2.5" role="img" aria-label={`Detik ${snap.beat + 1} daripada ${beatsPerBar}`}>
        {Array.from({ length: beatsPerBar }, (_, i) => {
          const on = i === snap.beat && (snap.phase === 'playing' || snap.phase === 'countin');
          return (
            <span
              key={i}
              className={`${size} rounded-full border-2 transition-all duration-75 ${
                on ? (i === 0 ? 'bg-gold-300 border-gold-300 scale-125 shadow-[0_0_16px_rgba(252,211,77,0.8)]' : 'bg-cyan-300 border-cyan-300 scale-125 shadow-[0_0_14px_rgba(34,211,238,0.8)]') : 'border-white/25'
              }`}
            />
          );
        })}
      </div>
      <div className="w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${snap.progress * 100}%` }} />
      </div>
    </div>
  );
}

const J_LABEL: Record<LiveJudgement, { t: string; c: string }> = {
  perfect: { t: 'SEMPURNA!', c: 'text-emerald-300' },
  ontime: { t: 'TEPAT', c: 'text-cyan-300' },
  early: { t: 'AWAL', c: 'text-amber-300' },
  late: { t: 'LEWAT', c: 'text-amber-300' },
  extra: { t: 'TAMBAHAN', c: 'text-rose-300' },
  rest: { t: 'REHAT! ✋', c: 'text-rose-300' },
};

export function JudgementFlash({ judgement, combo }: { judgement: { j: LiveJudgement; n: number; deltaMs?: number } | null; combo: number }) {
  if (!judgement) return <div className="h-14" aria-hidden />;
  const l = J_LABEL[judgement.j];
  return (
    <div className="h-14 flex flex-col items-center justify-center" aria-live="polite">
      <span key={judgement.n} className={`font-display font-bold text-2xl ${l.c} animate-pop`}>
        {l.t}
        {judgement.deltaMs != null && (judgement.j === 'early' || judgement.j === 'late') && <span className="text-sm ml-1">({Math.round(Math.abs(judgement.deltaMs))} ms)</span>}
      </span>
      {combo >= 3 && <span className="text-xs font-extrabold text-gold-300 tracking-wider">KOMBO ×{combo}</span>}
    </div>
  );
}

export function SessionControls({
  phase,
  runMode,
  onStart,
  onPause,
  onResume,
  onStop,
  onExit,
  onTap,
  canStartLive,
  startLabel = 'Mula Latihan',
}: {
  phase: string;
  runMode: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onExit: () => void;
  onTap: () => void;
  canStartLive: boolean;
  startLabel?: string;
}) {
  const active = phase === 'countin' || phase === 'playing' || phase === 'paused';

  // Kawalan papan kekunci: Enter/P = mula/jeda, Esc = henti, Ruang = tepuk (demo sahaja)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && runMode === 'demo-tap' && active) {
        e.preventDefault();
        onTap();
      } else if (e.key === 'Escape' && active) onStop();
      else if ((e.key === 'p' || e.key === 'P') && active) (phase === 'paused' ? onResume : onPause)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, phase, runMode, onTap, onStop, onPause, onResume]);

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {!active && (
        <button className="btn-primary text-lg !px-7" onClick={onStart} disabled={!canStartLive} aria-keyshortcuts="Enter">
          <Play size={20} className="fill-current" /> {startLabel}
        </button>
      )}
      {active && phase !== 'paused' && (
        <button className="btn-ghost" onClick={onPause} aria-keyshortcuts="P">
          <Pause size={18} /> Jeda
        </button>
      )}
      {phase === 'paused' && (
        <button className="btn-primary" onClick={onResume} aria-keyshortcuts="P">
          <Play size={18} /> Sambung
        </button>
      )}
      {active && (
        <button className="btn-ghost" onClick={onStop} aria-keyshortcuts="Escape">
          <RotateCcw size={18} /> Ulang
        </button>
      )}
      {active && runMode === 'demo-tap' && (
        <button className="btn-gold" onClick={onTap} aria-keyshortcuts="Space">
          <Hand size={18} /> Tepuk (Simulasi)
        </button>
      )}
      <button className="btn-ghost" onClick={onExit}>
        <LogOut size={18} /> Keluar
      </button>
    </div>
  );
}

export function DemoBanner({ runMode }: { runMode: string }) {
  if (runMode === 'live') return null;
  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 text-amber-100 px-3 py-2 text-sm font-bold flex items-center gap-2" role="status">
      <Sparkles size={16} /> MOD SIMULASI — {runMode === 'demo-auto' ? 'tepukan dijana oleh komputer' : 'tepukan melalui butang/kekunci Ruang'}. Markah TIDAK direkodkan.
    </div>
  );
}
