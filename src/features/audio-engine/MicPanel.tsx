import { useState } from 'react';
import { AlertTriangle, Hand, Loader2, Mic, MicOff, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { useClapDetection, useMicLevel, useOnClap } from './useClapDetection';
import { CalibrationWizard } from './CalibrationWizard';
import { Modal, Notice } from '@/components/ui';

/** Meter aras mikrofon (jalur tinggi) dengan penanda ambang. */
export function MicMeter({ level, threshold }: { level: number; threshold: number | null }) {
  const pct = (db: number) => Math.max(0, Math.min(100, ((db + 90) / 80) * 100));
  return (
    <div className="relative h-3 rounded-full bg-white/10 overflow-hidden" role="meter" aria-label="Aras mikrofon" aria-valuemin={-90} aria-valuemax={-10} aria-valuenow={Math.round(level)}>
      <div className="h-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-violet-400 transition-[width] duration-75" style={{ width: `${pct(level)}%` }} />
      {threshold != null && <div className="absolute top-0 bottom-0 w-0.5 bg-gold-300" style={{ left: `${pct(threshold)}%` }} title="Ambang tepukan" />}
    </div>
  );
}

/**
 * Panel status mikrofon: minta kebenaran, ralat & pemulihan, meter, ujian tepukan, kalibrasi.
 * onDemo — tawarkan mod simulasi jika mikrofon tidak tersedia.
 */
export function MicPanel({ onDemo, compact = false }: { onDemo?: () => void; compact?: boolean }) {
  const { settings } = useApp();
  const mic = useClapDetection();
  const level = useMicLevel();
  const [flash, setFlash] = useState(0);
  const [calib, setCalib] = useState(false);
  useOnClap(() => setFlash((n) => n + 1));

  if (mic.supportError) {
    return (
      <Notice tone="error" icon={<MicOff size={18} />}>
        <b>Mikrofon tidak tersedia.</b> {mic.supportError.message}
        {onDemo && (
          <div className="mt-2">
            <button className="btn-ghost !min-h-10 !py-2" onClick={onDemo}>
              <Sparkles size={16} /> Mod Demo (Simulasi)
            </button>
          </div>
        )}
      </Notice>
    );
  }

  if (mic.status === 'error' && mic.error) {
    return (
      <Notice tone="error" icon={<AlertTriangle size={18} />}>
        <b>Mikrofon tidak dapat digunakan.</b> {mic.error.message}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary !min-h-10 !py-2" onClick={() => void mic.request()}>
            Cuba Lagi
          </button>
          {onDemo && (
            <button className="btn-ghost !min-h-10 !py-2" onClick={onDemo}>
              <Sparkles size={16} /> Mod Demo (Simulasi)
            </button>
          )}
        </div>
      </Notice>
    );
  }

  if (mic.status !== 'ready') {
    return (
      <div className={`rounded-2xl border border-cyan-300/25 bg-cyan-400/5 p-4 ${compact ? '' : 'sm:p-5'}`}>
        <div className="flex items-start gap-3">
          <Mic className="text-cyan-300 shrink-0 mt-0.5" size={22} />
          <div className="flex-1">
            <p className="font-bold">Aktifkan mikrofon untuk mengesan tepukan anda</p>
            <p className="text-sm text-slate-400">Bunyi diproses dalam peranti ini sahaja. Tiada rakaman disimpan atau dihantar.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void mic.request()} disabled={mic.status === 'requesting'}>
            {mic.status === 'requesting' ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
            {mic.status === 'requesting' ? 'Menunggu kebenaran…' : 'Aktifkan Mikrofon'}
          </button>
          {onDemo && (
            <button className="btn-ghost" onClick={onDemo}>
              <Sparkles size={16} /> Mod Demo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/5 p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <span className="relative flex size-3" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full size-3 bg-emerald-400" />
        </span>
        <span className="font-bold text-sm text-emerald-200">Mikrofon aktif</span>
        <span key={flash} className={`ml-auto chip ${flash ? 'animate-flash text-gold-300 border-gold-300/40' : 'text-slate-400'}`} aria-live="polite">
          <Hand size={12} /> {flash ? `Tepukan dikesan (${flash})` : 'Tepuk untuk uji'}
        </span>
      </div>
      <div className="mt-2.5">
        <MicMeter level={level} threshold={settings.clapThreshold} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>{settings.calibratedAt ? `Dikalibrasi • latensi ${settings.latencyOffsetMs} ms` : 'Belum dikalibrasi — disyorkan sebelum penilaian.'}</span>
        <button className="btn-ghost !min-h-8 !py-1 !px-3 text-xs" onClick={() => setCalib(true)}>
          <SlidersHorizontal size={14} /> Kalibrasi
        </button>
      </div>
      <Modal open={calib} onClose={() => setCalib(false)} title="Kalibrasi Mikrofon">
        <CalibrationWizard onDone={() => setCalib(false)} />
      </Modal>
    </div>
  );
}
