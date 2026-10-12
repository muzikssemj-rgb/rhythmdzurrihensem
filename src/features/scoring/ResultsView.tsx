import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Award, Camera, CheckCircle2, CircleSlash, Clock, Cloud, Gauge, Lightbulb, Plus, Sparkles, ThumbsUp, TrendingUp } from 'lucide-react';
import type { Exercise } from '@/types';
import { useApp } from '@/app/AppStore';
import { buildTimeline, toExpectedEvents } from '@/lib/rhythm';
import { RhythmNotation, type NoteMark } from '@/components/RhythmNotation';
import { Notice, ProgressBar, Stars } from '@/components/ui';
import { achievementDef } from '@/features/achievements/achievements';
import { computeStars, getCategory } from './scoringEngine';
import { generateFeedback, suggestNext } from './feedback';
import { TimelineChart } from './TimelineChart';
import type { SessionResult } from '@/features/rhythm-practice/usePracticeSession';

const Reward3D = lazy(() => import('@/components/Reward3D'));

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (document.documentElement.classList.contains('reduce-motion')) {
      setV(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function ResultsView({ result, exercise, actions }: { result: SessionResult; exercise: Exercise; actions: ReactNode }) {
  const { config, settings } = useApp();
  const r = result.breakdown;
  const demo = result.runMode !== 'live';
  const stars = result.outcome?.stars ?? computeStars(r.total, exercise.passMark);
  const category = getCategory(r.total, config.categories);
  const score = useCountUp(r.total);
  const passed = r.total >= exercise.passMark;
  const feedback = useMemo(() => generateFeedback(r, exercise), [r, exercise]);

  // Tanda warna setiap not pada skor
  const marks = useMemo(() => {
    const exp = toExpectedEvents(buildTimeline(exercise, result.bpm)).filter((e) => e.type === 'clap');
    const m: Record<number, NoteMark> = {};
    for (const h of r.hits) {
      const tok = exp[h.targetIndex]?.index;
      if (tok != null) m[tok] = h.cls === 'perfect' || h.cls === 'ontime' ? 'hit' : h.cls;
    }
    for (const x of r.missed) {
      const tok = exp[x.targetIndex]?.index;
      if (tok != null) m[tok] = 'miss';
    }
    return m;
  }, [r, exercise, result.bpm]);

  const comps = [
    { label: 'Ketepatan Pola', v: r.pattern, max: r.max.pattern, color: 'from-cyan-400 to-sky-500' },
    { label: 'Ketepatan Masa', v: r.timing, max: r.max.timing, color: 'from-violet-400 to-fuchsia-500' },
    { label: 'Kestabilan Tempo', v: r.stability, max: r.max.stability, color: 'from-gold-300 to-gold-500' },
  ];
  const counts = [
    { label: 'Betul (tepat masa)', v: r.counts.onTime, icon: CheckCircle2, c: 'text-emerald-300' },
    { label: 'Terlalu awal', v: r.counts.early, icon: Clock, c: 'text-amber-300' },
    { label: 'Lewat', v: r.counts.late, icon: Clock, c: 'text-orange-300' },
    { label: 'Tertinggal', v: r.counts.missed, icon: CircleSlash, c: 'text-rose-300' },
    { label: 'Tambahan', v: r.counts.extra, icon: Plus, c: 'text-violet-300' },
    { label: 'Semasa rehat', v: r.counts.restViolations, icon: AlertTriangle, c: 'text-rose-400' },
  ];
  const trendText = { stabil: 'Stabil', melaju: 'Melaju (rushing)', melambat: 'Melambat (dragging)', 'tidak-cukup-data': 'Tidak cukup data' }[r.tempo.trend];
  const show3D = passed && !settings.reducedMotion && !demo;

  return (
    <div className="space-y-5">
      {demo && (
        <Notice tone="warn" icon={<Sparkles size={18} />}>
          <b>KEPUTUSAN SIMULASI.</b> Data ini dijana dalam Mod Demo dan tidak direkodkan sebagai penilaian sebenar.
        </Notice>
      )}

      <section className="card p-6 sm:p-8 relative overflow-hidden">
        {show3D && (
          <div className="absolute inset-0 pointer-events-none opacity-90" aria-hidden>
            <Suspense fallback={null}>
              <Reward3D stars={stars} />
            </Suspense>
          </div>
        )}
        <div className="relative grid md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="text-center md:text-left">
            <div className="text-xs font-extrabold tracking-[0.2em] text-slate-400">MARKAH</div>
            <div className="font-display font-bold leading-none text-8xl sm:text-9xl text-gradient" aria-label={`Markah ${r.total} daripada 100`}>
              {score}
            </div>
            <div className="text-slate-400 font-bold">daripada 100</div>
            <div className="mt-3">
              <Stars count={stars} size={34} animate />
            </div>
            <div className={`mt-2 inline-flex chip text-sm ${passed ? 'text-emerald-200 border-emerald-300/40' : 'text-amber-200 border-amber-300/40'}`}>
              {passed ? <ThumbsUp size={14} /> : <TrendingUp size={14} />} {category}
              {!passed && ` • Lulus ≥ ${exercise.passMark}`}
            </div>
          </div>
          <div className="space-y-4">
            {comps.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span>{c.label}</span>
                  <span>
                    {c.v} / {c.max}
                  </span>
                </div>
                <ProgressBar value={c.v} max={c.max} color={c.color} label={c.label} />
              </div>
            ))}
            {result.outcome && (
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="chip text-gold-200">+{result.outcome.xpGained} XP</span>
                <span className="chip">Kombo terbaik ×{r.maxCombo}</span>
                {result.outcome.levelUp && <span className="chip text-emerald-200 border-emerald-300/40 animate-pop">🎉 Tahap {result.outcome.levelUp} dibuka!</span>}
                {result.outcome.record.synced ? (
                  <span className="chip text-emerald-200">
                    <Cloud size={12} /> Disimpan ke awan
                  </span>
                ) : (
                  <span className="chip text-slate-300">Disimpan dalam peranti</span>
                )}
              </div>
            )}
            {result.outcome?.cloudError && <Notice tone="warn">Rekod disimpan dalam peranti tetapi gagal dihantar ke pelayan: {result.outcome.cloudError}</Notice>}
          </div>
        </div>
      </section>

      {result.outcome && result.outcome.newAchievements.length > 0 && (
        <section className="card p-5 border-gold-300/30">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
            <Award className="text-gold-300" /> Lencana baharu!
          </h2>
          <div className="flex flex-wrap gap-3">
            {result.outcome.newAchievements.map((c) => {
              const d = achievementDef(c);
              return (
                <div key={c} className="rounded-2xl bg-gold-400/10 border border-gold-300/30 px-4 py-3 animate-pop">
                  <div className="font-bold text-gold-200">{d?.title ?? c}</div>
                  <div className="text-xs text-slate-300">{d?.description}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">{actions}</div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {counts.map((c) => (
          <div key={c.label} className="card p-4 text-center">
            <c.icon className={`mx-auto ${c.c}`} size={22} />
            <div className="font-display text-3xl font-bold mt-1">{c.v}</div>
            <div className="text-xs text-slate-400 font-bold">{c.label}</div>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-lg mb-3">Analisis skor</h2>
        <div className="rounded-2xl bg-ink-950/60 p-2 sm:p-4">
          <RhythmNotation exercise={exercise} bpm={result.bpm} marks={marks} />
        </div>
        <p className="text-xs text-slate-400 mt-2">Hijau = tepat • Kuning = awal/lewat • Merah = tertinggal</p>
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-lg mb-3">Graf cap masa</h2>
        <TimelineChart exercise={exercise} bpm={result.bpm} result={r} />
      </section>

      <div className="grid md:grid-cols-2 gap-5">
        <section className="card p-5">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Lightbulb className="text-gold-300" size={20} /> Maklum balas
          </h2>
          <ul className="space-y-2">
            {feedback.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className={`mt-1 size-2 rounded-full shrink-0 ${f.tone === 'good' ? 'bg-emerald-400' : f.tone === 'warn' ? 'bg-rose-400' : 'bg-cyan-300'}`} aria-hidden />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-400 mt-3">
            <b>Cadangan susulan:</b> {suggestNext(r.total, exercise)}
          </p>
        </section>
        <section className="card p-5 space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Gauge className="text-cyan-300" size={20} /> Analisis tempo
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400">Tempo sasaran</dt>
              <dd className="font-bold text-lg">{result.bpm} BPM</dd>
            </div>
            <div>
              <dt className="text-slate-400">Anggaran tempo anda</dt>
              <dd className="font-bold text-lg">{r.tempo.sufficientData ? `${Math.round(r.tempo.estimatedBpm)} BPM` : '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Trend</dt>
              <dd className="font-bold">{trendText}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Kesekataan (jitter)</dt>
              <dd className="font-bold">{r.tempo.sufficientData ? `±${Math.round(r.tempo.jitterMs)} ms` : '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Purata anjakan masa</dt>
              <dd className="font-bold">
                {Math.round(Math.abs(r.tempo.meanOffsetMs))} ms {r.tempo.meanOffsetMs >= 0 ? 'lewat' : 'awal'}
              </dd>
            </div>
          </dl>
          {result.camera && (
            <div className="rounded-xl bg-violet-500/10 border border-violet-300/25 p-3 text-sm flex gap-2">
              <Camera size={18} className="text-violet-300 shrink-0" />
              <span>
                Pengesahan kamera: {result.camera.confirmed}/{r.counts.hits} tepukan disertai gerakan tangan ({result.camera.gestures} gerakan dikesan). Maklumat
                tambahan sahaja — tidak menjejaskan markah.
              </span>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Kategori prestasi ialah kategori gamifikasi, bukan pengganti standard pentaksiran rasmi KPM. Ketepatan bergantung pada peranti, mikrofon dan persekitaran.
          </p>
        </section>
      </div>
    </div>
  );
}
