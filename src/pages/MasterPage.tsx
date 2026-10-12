import { Link, useSearchParams } from 'react-router-dom';
import { Crown, Lock, Play } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { Notice, PageHeader, ProgressBar, Stars } from '@/components/ui';
import { RhythmNotation } from '@/components/RhythmNotation';
import { PracticeStage } from '@/features/rhythm-practice/PracticeStage';
import { useBestScores } from './PracticeHubPage';

export default function MasterPage() {
  const { exercises, profile, config } = useApp();
  const [params, setParams] = useSearchParams();
  const best = useBestScores();
  const list = exercises.filter((e) => e.level === 4);
  const playId = params.get('main');
  const playing = playId ? list.find((e) => e.id === playId) : undefined;

  if (profile.unlockedLevel < 4) {
    const l3 = exercises.filter((e) => e.level === 3);
    const passed = l3.filter((e) => (best.get(e.id)?.stars ?? 0) > 0).length;
    return (
      <div>
        <PageHeader title="Rhythm Master" backTo="/" />
        <div className="card p-8 text-center max-w-lg mx-auto">
          <Lock className="mx-auto text-gold-300" size={40} />
          <h2 className="text-2xl font-bold mt-3">Mod ini terkunci</h2>
          <p className="text-slate-300 mt-2">
            Buka Tahap 4 dengan lulus {Math.min(config.unlockPassCount, l3.length)} latihan Tahap 3 (Rhythm Expert). Anda kini di Tahap {profile.unlockedLevel}.
          </p>
          {profile.unlockedLevel === 3 && <ProgressBar className="mt-4" value={passed} max={Math.min(config.unlockPassCount, l3.length)} color="from-gold-300 to-gold-500" />}
          <Link to={`/latihan?tahap=${profile.unlockedLevel}`} className="btn-gold mt-5">
            Teruskan Latihan Tahap {profile.unlockedLevel}
          </Link>
        </div>
      </div>
    );
  }

  if (playing) {
    return (
      <div>
        <PageHeader title={playing.title} subtitle="Rhythm Master • bantuan audio dikurangkan" backTo="/master" />
        <PracticeStage
          key={playing.id}
          exercise={playing}
          mode="master"
          fixedTempo
          hideExample
          forceNoMetronome={config.masterNoMetronome && !!playing.allowNoMetronome}
          exitTo="/master"
          topSlot={
            <Notice icon={<Crown size={18} />}>
              Mod Rhythm Master: tiada contoh audio{config.masterNoMetronome && playing.allowNoMetronome ? ' dan tiada metronom selepas kiraan masuk' : ''}. Bergantung pada nadi dalaman anda!
            </Notice>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Rhythm Master" subtitle="Pola campuran lanjutan. Bantuan audio dikurangkan." backTo="/" />
      <div className="grid md:grid-cols-2 gap-4">
        {list.map((ex) => {
          const b = best.get(ex.id);
          return (
            <div key={ex.id} className="card p-5 space-y-3 border-gold-300/20">
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg">{ex.title}</h3>
                  <p className="text-sm text-slate-400">
                    {ex.bars.length} bar • {ex.tempoBpm} BPM • {ex.focus}
                  </p>
                </div>
                {b && <Stars count={b.stars} size={16} />}
              </div>
              <div className="rounded-2xl bg-ink-950/60 p-2">
                <RhythmNotation exercise={ex} />
              </div>
              <button className="btn-gold w-full" onClick={() => setParams({ main: ex.id })}>
                <Play size={18} className="fill-current" /> Main Mod Master
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
