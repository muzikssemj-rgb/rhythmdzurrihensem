import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, Home, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { Notice, PageHeader, Stars } from '@/components/ui';
import { PracticeStage } from '@/features/rhythm-practice/PracticeStage';
import { ResultsView } from '@/features/scoring/ResultsView';
import type { SessionResult } from '@/features/rhythm-practice/usePracticeSession';
import type { Exercise } from '@/types';
import { achievementDef } from '@/features/achievements/achievements';

const ROUNDS = 3;

function pickChallenge(exercises: Exercise[], unlocked: number): Exercise[] {
  const pool = exercises.filter((e) => e.level <= unlocked);
  // Utamakan tahap tertinggi yang dibuka, campur dengan tahap sebelumnya
  const top = pool.filter((e) => e.level === unlocked);
  const rest = pool.filter((e) => e.level !== unlocked);
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
  const picks = [...shuffle(top).slice(0, 2), ...shuffle(rest).slice(0, 1)];
  const fill = shuffle(pool.filter((e) => !picks.includes(e)));
  while (picks.length < ROUNDS && fill.length) picks.push(fill.shift()!);
  return picks.sort((a, b) => a.level - b.level || a.tempoBpm - b.tempoBpm).slice(0, ROUNDS);
}

export default function ChallengePage() {
  const { exercises, profile, recordChallenge } = useApp();
  const nav = useNavigate();
  const [set, setSet] = useState<Exercise[] | null>(null);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [viewing, setViewing] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);

  const start = () => {
    setSet(pickChallenge(exercises, profile.unlockedLevel));
    setRound(0);
    setResults([]);
    setViewing(false);
    setBadges([]);
  };

  const finished = set && results.length === set.length && !viewing;
  const anyDemo = results.some((r) => r.runMode !== 'live');
  const avg = useMemo(() => (results.length ? Math.round(results.reduce((s, r) => s + r.breakdown.total, 0) / results.length) : 0), [results]);

  if (!set) {
    return (
      <div>
        <PageHeader title="Rhythm Challenge" subtitle={`${ROUNDS} pola berturut-turut pada tempo guru. Purata ≥ 80 = Juara!`} backTo="/" />
        <div className="card p-8 text-center max-w-xl mx-auto">
          <Flame className="mx-auto text-rose-400" size={48} />
          <h2 className="text-2xl font-bold mt-3">Sedia untuk cabaran?</h2>
          <p className="text-slate-300 mt-2">Pola dipilih daripada tahap yang telah anda buka (sehingga Tahap {profile.unlockedLevel}). Setiap pola direkodkan.</p>
          <button className="btn-primary text-lg mt-6" onClick={start}>
            <Flame size={20} /> Mula Cabaran
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div>
        <PageHeader title="Keputusan Rhythm Challenge" backTo="/" />
        <div className="card p-8 text-center max-w-2xl mx-auto space-y-4">
          <Trophy className="mx-auto text-gold-300" size={52} />
          <div className="font-display text-7xl font-bold text-gradient">{avg}</div>
          <p className="text-slate-300">Purata markah {ROUNDS} pola</p>
          {anyDemo && (
            <Notice tone="warn" icon={<Sparkles size={18} />}>
              Sebahagian pusingan dimainkan dalam Mod Simulasi — tidak layak untuk lencana.
            </Notice>
          )}
          {badges.map((b) => (
            <div key={b} className="rounded-2xl bg-gold-400/10 border border-gold-300/30 px-4 py-3 animate-pop font-bold text-gold-200">
              Lencana baharu: {achievementDef(b)?.title}
            </div>
          ))}
          <ul className="text-left space-y-2">
            {results.map((r, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                <span className="font-bold flex-1">
                  {i + 1}. {set[i]!.title}
                </span>
                <Stars count={r.outcome?.stars ?? 0} size={16} />
                <span className="font-display text-xl font-bold w-12 text-right">{r.breakdown.total}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="btn-primary" onClick={start}>
              <RotateCcw size={18} /> CUBA LAGI
            </button>
            <button className="btn-ghost" onClick={() => nav('/')}>
              <Home size={18} /> KEMBALI KE MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ex = set[round]!;
  const last = results[results.length - 1];

  return (
    <div>
      <PageHeader title={`Cabaran ${Math.min(round + 1, set.length)}/${set.length}`} subtitle={viewing ? 'Keputusan pusingan' : ex.title} backTo="/" />
      <div className="flex gap-2 mb-4" aria-label="Kemajuan cabaran">
        {set.map((e, i) => (
          <div key={e.id + i} className={`h-2 flex-1 rounded-full ${i < results.length ? 'bg-gradient-to-r from-rose-400 to-orange-400' : i === round ? 'bg-white/30' : 'bg-white/10'}`} />
        ))}
      </div>
      {viewing && last ? (
        <ResultsView
          result={last}
          exercise={set[results.length - 1]!}
          actions={
            <button
              className="btn-primary text-lg"
              onClick={() => {
                setViewing(false);
                if (results.length < set.length) setRound(results.length);
                else if (!anyDemo) setBadges(recordChallenge(avg));
              }}
            >
              {results.length < set.length ? 'Pola Seterusnya' : 'Lihat Keputusan Akhir'} <ArrowRight size={20} />
            </button>
          }
        />
      ) : (
        <PracticeStage
          key={`${ex.id}-${round}`}
          exercise={ex}
          mode="challenge"
          fixedTempo
          exitTo="/"
          onComplete={(r) => {
            setResults((rs) => [...rs, r]);
            setViewing(true);
          }}
        />
      )}
    </div>
  );
}
