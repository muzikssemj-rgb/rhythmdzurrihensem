import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { LEVELS } from '@/data/exercises';
import { LEVEL_STYLES, Notice, PageHeader } from '@/components/ui';
import { ExerciseCard } from '@/features/rhythm-practice/ExerciseCard';
import { useExamplePlayer } from '@/features/rhythm-practice/useExamplePlayer';
import type { LevelId } from '@/types';

export function useBestScores() {
  const { myAttempts } = useApp();
  return useMemo(() => {
    const m = new Map<string, { best: number; stars: number }>();
    for (const a of myAttempts) {
      const cur = m.get(a.exerciseId);
      if (!cur || a.totalScore > cur.best) m.set(a.exerciseId, { best: a.totalScore, stars: Math.max(a.stars, cur?.stars ?? 0) });
      else if (a.stars > cur.stars) cur.stars = a.stars;
    }
    return m;
  }, [myAttempts]);
}

export default function PracticeHubPage({ mode = 'practice' }: { mode?: 'practice' | 'ar' }) {
  const { exercises, profile, config } = useApp();
  const [params, setParams] = useSearchParams();
  const level = (Number(params.get('tahap')) || Math.min(profile.unlockedLevel, 4)) as LevelId;
  const best = useBestScores();
  const player = useExamplePlayer();
  const list = exercises.filter((e) => e.level === level);
  const unlocked = level <= profile.unlockedLevel;
  const lv = LEVELS.find((l) => l.id === level)!;

  return (
    <div>
      <PageHeader
        title={mode === 'ar' ? 'Rhythm AR Arena' : 'Rhythm Practice'}
        subtitle={mode === 'ar' ? 'Pilih pola — kad irama akan muncul di atas paparan kamera.' : 'Pilih tahap dan latihan. Dengar contoh dahulu, kemudian tepuk!'}
        backTo="/"
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4" role="tablist" aria-label="Pilih tahap">
        {LEVELS.map((l) => {
          const open = l.id <= profile.unlockedLevel;
          const active = l.id === level;
          return (
            <button
              key={l.id}
              role="tab"
              aria-selected={active}
              onClick={() => {
                player.stop();
                setParams({ tahap: String(l.id) });
              }}
              className={`shrink-0 rounded-2xl px-4 py-2.5 font-bold text-sm border transition flex items-center gap-2 ${
                active ? `bg-gradient-to-r ${LEVEL_STYLES[l.id]!.grad} text-ink-950 border-transparent` : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {!open && <Lock size={14} />} Tahap {l.id}: {l.name}
            </button>
          );
        })}
      </div>

      <div className="mb-4 text-sm text-slate-400">
        <b className={LEVEL_STYLES[level]!.text}>{lv.name}</b> — {lv.topics.join(' • ')} • {lv.tempo}
      </div>

      {!unlocked ? (
        <Notice tone="warn" icon={<Lock size={18} />}>
          Tahap ini masih terkunci. Lulus sekurang-kurangnya {config.unlockPassCount} latihan dalam Tahap {level - 1} untuk membukanya. Anda masih boleh
          mendengar contoh pola di bawah.
        </Notice>
      ) : null}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
        {list.map((ex) => {
          const b = best.get(ex.id);
          return (
            <div key={ex.id} className={unlocked ? '' : 'opacity-70'}>
              <ExerciseCard
                ex={ex}
                to={mode === 'ar' ? `/ar/${ex.id}` : `/latihan/${ex.id}`}
                locked={!unlocked}
                best={b?.best}
                stars={b?.stars}
                playing={player.playingId === ex.id}
                getMusicTime={player.getMusicTime}
                onListen={() => (player.playingId === ex.id ? player.stop() : void player.play(ex))}
                startLabel={mode === 'ar' ? 'Mula AR' : 'Mula Latihan'}
              />
            </div>
          );
        })}
        {list.length === 0 && <p className="text-slate-400">Tiada latihan aktif dalam tahap ini.</p>}
      </div>
    </div>
  );
}
