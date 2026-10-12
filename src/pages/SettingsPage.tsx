import { Download, HardDrive, Hand, Metronome as MetIcon, Mic, MonitorSmartphone, RotateCcw, ShieldCheck, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS, useApp } from '@/app/AppStore';
import { Notice, PageHeader } from '@/components/ui';
import { MicPanel } from '@/features/audio-engine/MicPanel';
import { MetronomeTool } from '@/features/audio-engine/MetronomeTool';
import { isSupabaseConfigured } from '@/services/supabaseClient';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card p-5 space-y-4">
      <h2 className="font-bold text-lg flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Slider({ id, label, value, min, max, step = 1, unit = '', onChange, hint }: { id: string; label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label flex justify-between">
        <span>{label}</span>
        <span className="text-cyan-300">
          {value}
          {unit}
        </span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-cyan-400" />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <span className="flex-1">
        <span className="font-bold text-sm">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <input type="checkbox" className="size-5 accent-cyan-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, myAttempts, profile, backend, toast } = useApp();

  const exportMine = () => {
    const blob = new Blob([JSON.stringify({ profile, attempts: myAttempts }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rhythm-master-${profile.displayName.replace(/\W+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Tetapan" subtitle="Audio, mikrofon, paparan dan data" backTo="/" />
      <div className="grid lg:grid-cols-2 gap-5">
        <Section icon={<Mic className="text-cyan-300" />} title="Mikrofon & pengesanan tepukan">
          <MicPanel />
          <Slider
            id="sens"
            label="Sensitiviti"
            value={settings.sensitivity}
            min={0.5}
            max={2.5}
            step={0.1}
            unit="×"
            onChange={(v) => updateSettings({ sensitivity: v })}
            hint="Naikkan jika tepukan perlahan tidak dikesan; turunkan jika bunyi lain dikira sebagai tepukan."
          />
          <Slider
            id="refr"
            label="Tempoh refraktori (anti-gema)"
            value={settings.refractoryMs}
            min={40}
            max={160}
            step={5}
            unit=" ms"
            onChange={(v) => updateSettings({ refractoryMs: v })}
            hint="Masa minimum antara dua tepukan. Naikkan di bilik bergema; turunkan untuk semikuaver laju."
          />
          <Slider
            id="lat"
            label="Pampasan latensi"
            value={settings.latencyOffsetMs}
            min={-200}
            max={250}
            step={5}
            unit=" ms"
            onChange={(v) => updateSettings({ latencyOffsetMs: v })}
            hint="Ditolak daripada setiap cap masa tepukan. Gunakan Kalibrasi → Latensi untuk nilai automatik."
          />
          <button
            className="btn-ghost"
            onClick={() => {
              updateSettings({ clapThreshold: null, noiseFloor: null, calibratedAt: null, latencyOffsetMs: 0, sensitivity: 1, refractoryMs: DEFAULT_SETTINGS.refractoryMs });
              toast('Tetapan mikrofon ditetapkan semula');
            }}
          >
            <RotateCcw size={16} /> Set semula kalibrasi
          </button>
        </Section>

        <Section icon={<MetIcon className="text-gold-300" />} title="Metronom">
          <MetronomeTool volume={settings.metronomeVolume} />
          <Slider id="mvol" label="Kelantangan metronom" value={Math.round(settings.metronomeVolume * 100)} min={0} max={100} unit="%" onChange={(v) => updateSettings({ metronomeVolume: v / 100 })} />
          <Slider id="evol" label="Kelantangan contoh irama" value={Math.round(settings.exampleVolume * 100)} min={0} max={100} unit="%" onChange={(v) => updateSettings({ exampleVolume: v / 100 })} />
          <Notice icon={<Volume2 size={16} />}>Gunakan fon kepala jika boleh — bunyi metronom yang kuat dari pembesar suara boleh mengganggu pengesanan tepukan.</Notice>
        </Section>

        <Section icon={<MonitorSmartphone className="text-violet-300" />} title="Paparan & aksesibiliti">
          <Toggle label="Kurangkan animasi" hint="Matikan animasi & kesan 3D (juga mengikut tetapan sistem)." checked={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} />
          <Toggle label="Tunjuk titik sendi tangan" hint="Overlay pengesanan tangan pada paparan kamera." checked={settings.showHandOverlay} onChange={(v) => updateSettings({ showHandOverlay: v })} />
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Hand size={12} /> Bahasa: Bahasa Melayu (istilah muzik standard seperti Tempo, Beat, BPM dikekalkan).
          </p>
        </Section>

        <Section icon={<HardDrive className="text-teal-300" />} title="Data & privasi">
          <Notice icon={<ShieldCheck size={16} />}>
            Audio mikrofon dan video kamera diproses dalam peranti ini sahaja dan <b>tidak dirakam atau dimuat naik</b>. Hanya markah dan cap masa tepukan disimpan.
          </Notice>
          <p className="text-sm text-slate-300">
            Mod storan: <b>{backend === 'supabase' ? 'Awan (Supabase)' : 'Mod Tempatan — dalam pelayar ini sahaja'}</b>
            {!isSupabaseConfigured && '. Backend belum dikonfigurasikan oleh pentadbir.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={exportMine}>
              <Download size={16} /> Eksport data saya (JSON)
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
