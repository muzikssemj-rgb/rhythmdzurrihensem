import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, Hand, Loader2, Mic, Timer, Volume2 } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { useClapDetection, useMicLevel, useOnClap } from './useClapDetection';
import { analyzeNoise, estimateLatency, recommendThreshold, type ThresholdRecommendation } from './audioCalibration';
import { ensureAudioRunning } from './audioContext';
import { scheduleClick } from './synth';
import { MicMeter } from './MicPanel';
import { Notice } from '@/components/ui';

type Step = 'intro' | 'noise' | 'claps' | 'clapsDone' | 'latency' | 'done';

/**
 * Kalibrasi 3 langkah:
 *  1. Ukur bunyi latar (sambil metronom berbunyi — supaya bocoran detikan ikut diukur).
 *  2. Murid menepuk 4 kali → laraskan ambang pengesanan.
 *  3. (Pilihan) Tepuk bersama 8 detikan → anggar latensi peranti.
 */
export function CalibrationWizard({ onDone }: { onDone?: () => void }) {
  const { settings, updateSettings, toast } = useApp();
  const mic = useClapDetection();
  const level = useMicLevel();
  const [step, setStep] = useState<Step>('intro');
  const [rec, setRec] = useState<ThresholdRecommendation | null>(null);
  const [latency, setLatency] = useState<ReturnType<typeof estimateLatency> | null>(null);
  const [liveClaps, setLiveClaps] = useState(0);
  const [beat, setBeat] = useState(-1);
  const clapTimes = useRef<number[]>([]);
  const busy = step === 'noise' || step === 'claps' || step === 'latency';

  useOnClap(
    (o) => {
      clapTimes.current.push(o.time);
      setLiveClaps((n) => n + 1);
    },
    step === 'latency' || step === 'claps',
  );

  const run = useCallback(async () => {
    const input = mic.input ?? (await mic.request());
    if (!input) return;
    const ctx = await ensureAudioRunning();
    // 1. Hingar latar
    setStep('noise');
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.1;
    for (let i = 0; i < 5; i++) scheduleClick(ctx, out, t0 + i * 0.6, i === 0, settings.metronomeVolume);
    const noiseFrames = await input.collect(3);
    out.disconnect();
    const noise = analyzeNoise(noiseFrames);
    // 2. Tepukan ujian
    setLiveClaps(0);
    clapTimes.current = [];
    setStep('claps');
    const clapFrames = await input.collect(5);
    const r = recommendThreshold(noise, clapFrames, 4);
    setRec(r);
    if (r.clapsFound > 0) {
      updateSettings({ clapThreshold: r.thresholdDb, noiseFloor: noise.medianDb, calibratedAt: new Date().toISOString() });
      input.detector.configure({ calibratedThresholdDb: r.thresholdDb });
    }
    setStep('clapsDone');
  }, [mic, settings.metronomeVolume, updateSettings]);

  const runLatency = useCallback(async () => {
    const input = mic.input;
    if (!input) return;
    const ctx = await ensureAudioRunning();
    setStep('latency');
    setLiveClaps(0);
    clapTimes.current = [];
    input.detector.reset();
    const spb = 60 / 80;
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.3;
    const clicks: number[] = [];
    for (let i = 0; i < 12; i++) {
      const t = t0 + i * spb;
      scheduleClick(ctx, out, t, i % 4 === 0, settings.metronomeVolume);
      if (i >= 4) clicks.push(t);
    }
    const tick = window.setInterval(() => {
      const b = Math.floor((ctx.currentTime - t0) / spb);
      setBeat(b);
    }, 50);
    await new Promise((r) => window.setTimeout(r, (t0 - ctx.currentTime + 12 * spb + 0.5) * 1000));
    window.clearInterval(tick);
    out.disconnect();
    setBeat(-1);
    const est = estimateLatency(clapTimes.current, clicks);
    setLatency(est);
    if (est.reliable) {
      updateSettings({ latencyOffsetMs: Math.round(est.offsetMs) });
      toast(`Latensi dikalibrasi: ${Math.round(est.offsetMs)} ms`, 'success');
    }
    setStep('done');
  }, [mic.input, settings.metronomeVolume, updateSettings, toast]);

  return (
    <div className="space-y-4">
      <ol className="flex gap-2 text-xs font-bold" aria-label="Langkah kalibrasi">
        {[
          { k: ['noise'], label: '1. Bunyi latar', icon: Volume2 },
          { k: ['claps', 'clapsDone'], label: '2. Tepuk 4 kali', icon: Hand },
          { k: ['latency', 'done'], label: '3. Latensi', icon: Timer },
        ].map((s) => (
          <li key={s.label} className={`chip ${s.k.includes(step) ? 'text-cyan-200 border-cyan-300/40' : 'text-slate-400'}`}>
            <s.icon size={12} /> {s.label}
          </li>
        ))}
      </ol>

      <MicMeter level={level} threshold={settings.clapThreshold} />

      {step === 'intro' && (
        <>
          <p className="text-slate-300">
            Kalibrasi menyesuaikan pengesan tepukan dengan bilik dan peranti anda. Letakkan peranti kira-kira 30–100 cm di hadapan anda. Untuk hasil terbaik
            gunakan fon kepala atau perlahankan pembesar suara.
          </p>
          {mic.error && <Notice tone="error">{mic.error.message}</Notice>}
          <button className="btn-primary w-full" onClick={() => void run()} disabled={mic.status === 'requesting'}>
            {mic.status === 'requesting' ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />} Mula Kalibrasi
          </button>
        </>
      )}
      {step === 'noise' && (
        <Notice icon={<Loader2 className="animate-spin" size={18} />}>Diam sebentar… mengukur bunyi latar (3 saat).</Notice>
      )}
      {step === 'claps' && (
        <div className="text-center py-4">
          <div className="text-5xl font-display font-bold text-gradient animate-pulse">TEPUK 4 KALI!</div>
          <p className="text-slate-400 mt-2">Tepuk dengan kekuatan biasa, seperti semasa latihan.</p>
        </div>
      )}
      {step === 'clapsDone' && rec && (
        <div className="space-y-3">
          <Notice tone={rec.quality === 'lemah' ? 'warn' : 'success'} icon={<CheckCircle2 size={18} />}>
            <b>
              {rec.clapsFound}/4 tepukan dikesan • Kualiti isyarat: {rec.quality}
            </b>
            <br />
            {rec.message}
          </Notice>
          <div className="flex flex-col sm:flex-row gap-2">
            <button className="btn-ghost flex-1" onClick={() => void run()}>
              Ulang Langkah 1–2
            </button>
            <button className="btn-primary flex-1" onClick={() => void runLatency()} disabled={rec.clapsFound === 0}>
              <Timer size={18} /> Kalibrasi Latensi
            </button>
            <button className="btn-ghost flex-1" onClick={() => onDone?.()}>
              Selesai
            </button>
          </div>
        </div>
      )}
      {step === 'latency' && (
        <div className="text-center py-3">
          <p className="font-bold">{beat < 4 ? 'Dengar 4 detikan kiraan masuk…' : 'Tepuk TEPAT bersama setiap detikan!'}</p>
          <div className="flex justify-center gap-2 mt-3" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={`size-4 rounded-full transition ${i === beat ? (i < 4 ? 'bg-violet-400 scale-125' : 'bg-cyan-300 scale-125') : i < beat ? 'bg-white/30' : 'bg-white/10'}`} />
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-2">Tepukan dikesan: {liveClaps}</p>
        </div>
      )}
      {step === 'done' && latency && (
        <div className="space-y-3">
          <Notice tone={latency.reliable ? 'success' : 'warn'}>
            {latency.reliable
              ? `Latensi gabungan ≈ ${Math.round(latency.offsetMs)} ms (${latency.matched} tepukan dipadankan). Nilai ini akan ditolak daripada setiap tepukan.`
              : `Keputusan tidak konsisten (${latency.matched} tepukan dipadankan). Latensi tidak diubah — cuba lagi dengan tepukan yang lebih sekata.`}
          </Notice>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => void runLatency()}>
              Ulang
            </button>
            <button className="btn-primary flex-1" onClick={() => onDone?.()}>
              Selesai
            </button>
          </div>
        </div>
      )}
      {busy && <p className="text-xs text-slate-500 text-center">Audio diproses setempat dalam pelayar — tiada rakaman disimpan atau dimuat naik.</p>}
    </div>
  );
}
