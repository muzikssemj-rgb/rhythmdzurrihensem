import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronDown, Gauge, Info, Loader2, Metronome as MetronomeIcon, Sparkles, Square, Volume2 } from 'lucide-react';
import type { AttemptMode, Exercise } from '@/types';
import { useApp } from '@/app/AppStore';
import { barCapacity, meterLabel, TEMPO_MAX, TEMPO_MIN } from '@/lib/rhythm';
import { RhythmNotation } from '@/components/RhythmNotation';
import { Notice } from '@/components/ui';
import { MicPanel } from '@/features/audio-engine/MicPanel';
import { useClapDetection } from '@/features/audio-engine/useClapDetection';
import { getAudioContext } from '@/features/audio-engine/audioContext';
import { CameraPanel } from '@/features/hand-tracking/CameraPanel';
import { usePracticeSession, type SessionResult } from './usePracticeSession';
import { useExamplePlayer } from './useExamplePlayer';
import { BeatIndicator, DemoBanner, JudgementFlash, SessionControls } from './SessionWidgets';
import type { SessionMode } from './sessionEngine';

export interface PracticeStageProps {
  exercise: Exercise;
  mode: AttemptMode;
  /** Tempo dikunci (cabaran/harian). */
  fixedTempo?: boolean;
  /** Paksa tanpa metronom semasa persembahan (Rhythm Master). */
  forceNoMetronome?: boolean;
  /** Sembunyikan butang Dengar Contoh (pengurangan bantuan audio). */
  hideExample?: boolean;
  onComplete?: (r: SessionResult) => void;
  exitTo: string;
  topSlot?: ReactNode;
  startLabel?: string;
}

export function PracticeStage({ exercise: ex, mode, fixedTempo, forceNoMetronome, hideExample, onComplete, exitTo, topSlot, startLabel }: PracticeStageProps) {
  const nav = useNavigate();
  const { config } = useApp();
  const mic = useClapDetection();
  const [bpm, setBpm] = useState(ex.tempoBpm);
  const canNoMetro = ex.level === 4 && config.masterNoMetronome && !!ex.allowNoMetronome;
  const [metroOn, setMetroOn] = useState(!forceNoMetronome);
  const [cameraOn, setCameraOn] = useState(false);
  const [showCam, setShowCam] = useState(false);
  const [demoChoice, setDemoChoice] = useState(false);
  const example = useExamplePlayer();

  const complete = useCallback(
    (r: SessionResult) => {
      if (onComplete) onComplete(r);
      else nav('/keputusan', { state: r });
    },
    [onComplete, nav],
  );

  const session = usePracticeSession({
    exercise: ex,
    mode,
    bpm,
    metronomeDuringPerformance: forceNoMetronome ? false : metroOn || !canNoMetro,
    onComplete: complete,
    cameraActive: cameraOn,
  });

  const onGesture = useCallback(
    (perfNow: number) => {
      const ctx = getAudioContext();
      session.addCameraClap(ctx.currentTime - (performance.now() - perfNow) / 1000);
    },
    [session],
  );

  const startRun = (rm: SessionMode) => {
    example.stop();
    setDemoChoice(false);
    void session.start(rm);
  };

  const exampleTime = example.playingId ? example.getMusicTime : null;
  const getMusicTime = session.active ? session.getMusicTime : exampleTime;
  const micReady = mic.status === 'ready';

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5">
      <section className="space-y-4 min-w-0">
        {topSlot}
        <DemoBanner runMode={session.active ? session.runMode : 'live'} />
        <div className="card p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
            <span className="chip">Meter {meterLabel(ex.meter)}</span>
            <span className="chip">
              <Gauge size={12} /> {bpm} BPM
            </span>
            <span className="chip">{ex.focus}</span>
            {!metroOn && <span className="chip text-gold-300">Tanpa metronom</span>}
          </div>
          <div className="rounded-2xl bg-ink-950/60 border border-white/5 p-2 sm:p-4">
            <RhythmNotation exercise={ex} bpm={bpm} getMusicTime={getMusicTime ?? undefined} maxBarsPerRow={4} scale={1.15} />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="hidden sm:block" />
            <BeatIndicator getSnapshot={session.getSnapshot} beatsPerBar={barCapacity(ex.meter)} large />
            <JudgementFlash judgement={session.active ? session.judgement : null} combo={session.combo} />
          </div>
          {session.active && (
            <p className="text-center text-xs text-slate-400 mt-1" aria-live="polite">
              Tepukan dikesan: {session.clapCount}
            </p>
          )}
          {session.phase === 'scoring' && (
            <p className="text-center text-slate-300 mt-2 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Mengira markah…
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3">
            {!session.active && !hideExample && (
              <div className="flex justify-center">
                <button
                  className="btn-ghost"
                  onClick={() => (example.playingId ? example.stop() : void example.play(ex, bpm, metroOn))}
                  aria-pressed={!!example.playingId}
                >
                  {example.playingId ? <Square size={18} /> : <Volume2 size={18} />} {example.playingId ? 'Henti Contoh' : 'Dengar Contoh'}
                </button>
              </div>
            )}
            <SessionControls
              phase={session.phase}
              runMode={session.runMode}
              canStartLive={session.phase !== 'scoring'}
              startLabel={startLabel ?? (micReady ? 'Mula Latihan' : 'Aktifkan Mikrofon & Mula')}
              onStart={() => startRun('live')}
              onPause={() => void session.pause()}
              onResume={() => void session.resume()}
              onStop={session.stop}
              onExit={() => {
                session.stop();
                example.stop();
                nav(exitTo);
              }}
              onTap={session.tap}
            />
            {session.error && <Notice tone="error">{session.error}</Notice>}
            {!session.active && (mic.status === 'error' || !!mic.supportError || demoChoice) && (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-3 text-sm">
                <p className="font-bold text-amber-100 flex items-center gap-2">
                  <Sparkles size={16} /> Mod Demo (Simulasi) — markah tidak direkod
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button className="btn-ghost !min-h-10 !py-2" onClick={() => startRun('demo-tap')}>
                    Tepuk dengan butang / Ruang
                  </button>
                  <button className="btn-ghost !min-h-10 !py-2" onClick={() => startRun('demo-auto')}>
                    Tonton demo automatik
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <details className="card p-4 group">
          <summary className="flex items-center gap-2 font-bold cursor-pointer list-none">
            <Info size={18} className="text-cyan-300" /> Panduan latihan <ChevronDown size={16} className="ml-auto group-open:rotate-180 transition" />
          </summary>
          <div className="mt-3 text-sm text-slate-300 space-y-2">
            <p>{ex.description}</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Tekan <b>Dengar Contoh</b> dan ikuti garis penunjuk pada skor.</li>
              <li>Tekan <b>Mula Latihan</b>. Dengar {config.countInBars} bar kiraan masuk.</li>
              <li>Tepuk sekali pada setiap not. Diam pada tanda rehat. Not panjang ditepuk sekali sahaja.</li>
              <li>Kawalan papan kekunci: <kbd>P</kbd> jeda/sambung, <kbd>Esc</kbd> henti.</li>
            </ol>
          </div>
        </details>
      </section>

      <aside className="space-y-4">
        <MicPanel onDemo={() => setDemoChoice(true)} />

        {!fixedTempo && (
          <div className="card p-4">
            <label htmlFor="bpm" className="label flex items-center justify-between">
              <span>Tempo latihan</span> <span className="text-cyan-300 font-display text-lg">{bpm} BPM</span>
            </label>
            <input
              id="bpm"
              type="range"
              min={Math.max(TEMPO_MIN, ex.tempoBpm - 30)}
              max={Math.min(TEMPO_MAX, ex.tempoBpm + 20)}
              value={bpm}
              disabled={session.active}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>Perlahan</span>
              <button className="underline" onClick={() => setBpm(ex.tempoBpm)} disabled={session.active}>
                Tempo guru ({ex.tempoBpm})
              </button>
              <span>Laju</span>
            </div>
          </div>
        )}

        {canNoMetro && !forceNoMetronome && (
          <label className="card p-4 flex items-center gap-3 cursor-pointer">
            <MetronomeIcon size={20} className="text-gold-300" />
            <span className="flex-1 text-sm font-bold">
              Metronom semasa persembahan
              <span className="block text-xs text-slate-400 font-normal">Matikan untuk cabaran Rhythm Master (kiraan masuk kekal).</span>
            </span>
            <input type="checkbox" className="size-5 accent-cyan-400" checked={metroOn} disabled={session.active} onChange={(e) => setMetroOn(e.target.checked)} />
          </label>
        )}

        <div className="card p-4">
          <button
            className="w-full flex items-center gap-2 font-bold"
            onClick={() => {
              if (showCam) setCameraOn(false);
              setShowCam((s) => !s);
            }}
            aria-expanded={showCam}
          >
            <Camera size={18} className="text-violet-300" /> Kamera & pengesanan tangan <span className="text-xs text-slate-400 font-normal">(pilihan)</span>
            <ChevronDown size={16} className={`ml-auto transition ${showCam ? 'rotate-180' : ''}`} />
          </button>
          {showCam && (
            <div className="mt-3">
              <CameraPanel onGesture={onGesture} onActiveChange={setCameraOn} />
              <p className="text-xs text-slate-400 mt-2">Kamera hanya mengesahkan gerakan tangan. Markah dikira daripada bunyi tepukan (mikrofon).</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
