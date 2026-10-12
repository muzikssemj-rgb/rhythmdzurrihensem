import PracticeHubPage from './PracticeHubPage';
import { Notice } from '@/components/ui';
import { Camera } from 'lucide-react';

export default function ArenaHubPage() {
  return (
    <div className="space-y-4">
      <PracticeHubPage mode="ar" />
      <Notice icon={<Camera size={18} />}>
        Mod AR menggunakan kamera hadapan dan mikrofon. Kamera hanya untuk paparan dan gerakan tangan — markah dikira daripada bunyi tepukan. Jika kamera tidak
        tersedia, Arena akan menggunakan latar visual alternatif.
      </Notice>
    </div>
  );
}
