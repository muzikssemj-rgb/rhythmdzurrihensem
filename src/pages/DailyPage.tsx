import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, Flame, Play } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { Notice, PageHeader } from '@/components/ui';
import { RhythmNotation } from '@/components/RhythmNotation';
import { PracticeStage } from '@/features/rhythm-practice/PracticeStage';
import { dailyExercise, dailyStreak, todayKey } from '@/features/achievements/achievements';
import { meterLabel } from '@/lib/rhythm';
import type { SessionResult } from '@/features/rhythm-practice/usePracticeSession';

export default function DailyPage() {
  const { exercises, profile, completeDaily } = useApp();
  const nav = useNavigate();
  const [playing, setPlaying] = useState(false);
  const ex = dailyExercise(exercises, profile.unlockedLevel);
  const done = profile.dailyHistory.includes(todayKey());
  const streak = dailyStreak(profile.dailyHistory);

  if (!ex) return <Notice>Tiada latihan tersedia.</Notice>;

  const onComplete = (r: SessionResult) => {
    let extra: string[] = [];
    if (r.runMode === 'live' && r.breakdown.total >= ex.passMark) extra = completeDaily();
    const outcome = r.outcome ? { ...r.outcome, newAchievements: [...r.outcome.newAchievements, ...extra] } : null;
    nav('/keputusan', { state: { ...r, outcome } });
  };

  // 14 hari terakhir
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return { key: todayKey(d), label: d.getDate() };
  });

  return (
    <div>
      <PageHeader title="Daily Rhythm Challenge" subtitle="Satu pola istimewa setiap hari — sama untuk semua murid." backTo="/" />
      {!playing ? (
        <div className="grid md:grid-cols-[1fr_320px] gap-5">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 text-teal-300 font-extrabold text-sm tracking-wider">
              <Calendar size={16} /> CABARAN HARI INI • {new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <h2 className="text-3xl font-bold">{ex.title}</h2>
            <p className="text-slate-300">
              Tahap {ex.level} • {meterLabel(ex.meter)} • {ex.tempoBpm} BPM • {ex.focus}
            </p>
            <div className="rounded-2xl bg-ink-950/60 p-3">
              <RhythmNotation exercise={ex} />
            </div>
            {done && (
              <Notice tone="success" icon={<CheckCircle2 size={18} />}>
                Anda telah lulus cabaran hari ini! Anda boleh mencuba lagi untuk markah lebih tinggi.
              </Notice>
            )}
            <button className="btn-primary text-lg" onClick={() => setPlaying(true)}>
              <Play size={20} className="fill-current" /> {done ? 'Main Semula' : 'Sahut Cabaran'}
            </button>
            <p className="text-xs text-slate-400">Tempo dikunci. Lulus ≥ {ex.passMark} untuk mengekalkan streak harian.</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <Flame className="text-orange-400" size={36} />
              <div>
                <div className="text-4xl font-display font-bold">{streak}</div>
                <div className="text-sm text-slate-400">hari berturut-turut</div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 mt-5" aria-label="Rekod 14 hari terakhir">
              {days.map((d) => {
                const ok = profile.dailyHistory.includes(d.key);
                return (
                  <div
                    key={d.key}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold ${ok ? 'bg-gradient-to-br from-teal-300 to-emerald-500 text-ink-950' : 'bg-white/5 text-slate-500'}`}
                    title={`${d.key}${ok ? ' — selesai' : ''}`}
                  >
                    {ok ? '✓' : d.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <PracticeStage exercise={ex} mode="daily" fixedTempo exitTo="/" onComplete={onComplete} />
      )}
    </div>
  );
}
