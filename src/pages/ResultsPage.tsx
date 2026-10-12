import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Home, RotateCcw } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { Notice, PageHeader } from '@/components/ui';
import { ResultsView } from '@/features/scoring/ResultsView';
import type { SessionResult } from '@/features/rhythm-practice/usePracticeSession';

export function retryPath(r: SessionResult): string {
  switch (r.mode) {
    case 'ar':
      return `/ar/${r.exerciseId}`;
    case 'daily':
      return '/harian';
    case 'master':
      return `/master?main=${r.exerciseId}`;
    case 'challenge':
      return '/cabaran';
    default:
      return `/latihan/${r.exerciseId}`;
  }
}

export default function ResultsPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const { getExercise, exercises, profile } = useApp();
  const result = loc.state as SessionResult | null;
  const ex = result ? getExercise(result.exerciseId) : undefined;

  if (!result || !ex) {
    return (
      <div>
        <PageHeader title="Keputusan" backTo="/" />
        <Notice>Tiada keputusan untuk dipaparkan. Selesaikan satu latihan dahulu.</Notice>
        <Link to="/latihan" className="btn-primary mt-4">
          Mula Latihan
        </Link>
      </div>
    );
  }

  // Latihan seterusnya: ikut susunan dalam tahap, kemudian tahap seterusnya (jika dibuka)
  const idx = exercises.findIndex((e) => e.id === ex.id);
  const next = exercises.slice(idx + 1).find((e) => e.level <= profile.unlockedLevel);
  const nextPath = next ? (result.mode === 'ar' ? `/ar/${next.id}` : `/latihan/${next.id}`) : null;

  return (
    <div>
      <PageHeader title={`Keputusan: ${ex.title}`} subtitle={`Tahap ${ex.level} • ${result.bpm} BPM`} backTo="/" />
      <ResultsView
        result={result}
        exercise={ex}
        actions={
          <>
            <button className="btn-primary text-lg" onClick={() => nav(retryPath(result))}>
              <RotateCcw size={20} /> CUBA LAGI
            </button>
            <button className="btn-violet text-lg" disabled={!nextPath} onClick={() => nextPath && nav(nextPath)} title={nextPath ? undefined : 'Tiada latihan seterusnya yang dibuka'}>
              LATIHAN SETERUSNYA <ArrowRight size={20} />
            </button>
            <button className="btn-ghost text-lg" onClick={() => nav('/')}>
              <Home size={20} /> KEMBALI KE MENU
            </button>
          </>
        }
      />
    </div>
  );
}
