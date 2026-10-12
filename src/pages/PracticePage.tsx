import { Link, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { Notice, PageHeader } from '@/components/ui';
import { PracticeStage } from '@/features/rhythm-practice/PracticeStage';

export default function PracticePage() {
  const { id = '' } = useParams();
  const { getExercise, profile } = useApp();
  const ex = getExercise(id);
  if (!ex) {
    return (
      <div>
        <PageHeader title="Latihan tidak dijumpai" backTo="/latihan" />
        <Notice tone="warn">Latihan ini mungkin telah dipadam oleh guru.</Notice>
        <Link to="/latihan" className="btn-primary mt-4">
          Pilih latihan lain
        </Link>
      </div>
    );
  }
  const locked = ex.level > profile.unlockedLevel;
  return (
    <div>
      <PageHeader title={ex.title} subtitle={`Rhythm Practice • Tahap ${ex.level}`} backTo={`/latihan?tahap=${ex.level}`} />
      {locked ? (
        <Notice tone="warn" icon={<Lock size={18} />}>
          Tahap {ex.level} masih terkunci untuk {profile.displayName}. Lulus latihan di tahap sebelumnya dahulu.{' '}
          <Link className="underline font-bold" to={`/latihan?tahap=${profile.unlockedLevel}`}>
            Ke Tahap {profile.unlockedLevel}
          </Link>
        </Notice>
      ) : (
        <PracticeStage key={ex.id} exercise={ex} mode="practice" exitTo={`/latihan?tahap=${ex.level}`} />
      )}
    </div>
  );
}
