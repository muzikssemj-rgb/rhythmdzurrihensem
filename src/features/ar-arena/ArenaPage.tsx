import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, CameraOff, Hand, Loader2, Maximize2, Mic, Minimize2, Sparkles, SwitchCamera, Volume2, X } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { barCapacity, meterLabel } from '@/lib/rhythm';
import { RhythmNotation } from '@/components/RhythmNotation';
import { Notice } from '@/components/ui';
import { useCamera } from '@/features/hand-tracking/useCamera';
import { useHandTracking } from '@/features/hand-tracking/useHandTracking';
import { useClapDetection } from '@/features/audio-engine/useClapDetection';
import { getAudioContext } from '@/features/audio-engine/audioContext';
import { usePracticeSession } from '@/features/rhythm-practice/usePracticeSession';
import { useExamplePlayer } from '@/features/rhythm-practice/useExamplePlayer';
import { BeatIndicator, DemoBanner, JudgementFlash, SessionControls } from '@/features/rhythm-practice/SessionWidgets';
import type { SessionMode } from '@/features/rhythm-practice/sessionEngine';

const ArScene = lazy(() => import('./ArScene').then((m) => ({ default: m.ArScene })));

type Scale = 'S' | 'M' | 'L';
const SCALE_W: Record<Scale, string> = { S: 'max-w-md', M: 'max-w-2xl', L: 'max-w-4xl' };

/**
 * RHYTHM AR ARENA — AR berasaskan "camera overlay":
 * video kamera langsung + kad irama 3D (CSS 3D) + lapisan Three.js (trek detik, letupan bintang, not terapung)
 * + titik sendi tangan MediaPipe. Markah daripada mikrofon.
 */
export default function ArenaPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { getExercise, settings, profile } = useApp();
  const ex = getExercise(id);
  const mic = useClapDetection();
  const cam = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState<Scale>('M');
  const [noCamera, setNoCamera] = useState(false);
  const [intro, setIntro] = useState(true);
  const example = useExamplePlayer();

  const session = usePracticeSession({
    exercise: ex,
    mode: 'ar',
    bpm: ex?.tempoBpm ?? 80,
    metronomeDuringPerformance: true,
    cameraActive: cam.status === 'on',
    onComplete: (r) => {
      cam.stop();
      nav('/keputusan', { state: r });
    },
  });

  const mirrored = cam.facing === 'user';
  const track = useHandTracking({
    videoRef: cam.videoRef,
    canvasRef,
    enabled: cam.status === 'on',
    drawOverlay: settings.showHandOverlay,
    mirrored,
    maxFps: 20,
    onGesture: useCallback(
      (perfNow: number) => {
        const ctx = getAudioContext();
        session.addCameraClap(ctx.currentTime - (performance.now() - perfNow) / 1000);
      },
      [session],
    ),
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!ex) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="card p-6 text-center space-y-3">
          <p>Latihan tidak dijumpai.</p>
          <Link className="btn-primary" to="/ar">
            Kembali ke Arena
          </Link>
        </div>
      </div>
    );
  }
  const locked = ex.level > profile.unlockedLevel;

  const begin = async (withCamera: boolean) => {
    setIntro(false);
    if (withCamera) {
      const ok = await cam.start('user');
      if (!ok) setNoCamera(true);
    } else setNoCamera(true);
    if (mic.status !== 'ready') void mic.request();
  };

  const exit = () => {
    session.stop();
    example.stop();
    cam.stop();
    nav('/ar');
  };

  const startRun = (rm: SessionMode) => {
    example.stop();
    void session.start(rm);
  };

  const getMusicTime = session.active ? session.getMusicTime : example.playingId ? example.getMusicTime : undefined;

  return (
    <div className="fixed inset-0 bg-ink-950 text-white overflow-hidden select-none">
      {/* Latar: kamera langsung atau visual alternatif */}
      <video
        ref={cam.attach}
        className={`absolute inset-0 size-full object-cover ${cam.status === 'on' ? '' : 'opacity-0'}`}
        style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
        muted
        playsInline
        aria-label="Paparan kamera langsung"
      />
      <canvas ref={canvasRef} className="absolute inset-0 size-full object-cover pointer-events-none" style={mirrored ? { transform: 'scaleX(-1)' } : undefined} aria-hidden />
      {cam.status !== 'on' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.35),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.25),transparent_55%)]" aria-hidden />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-transparent to-ink-950/80 pointer-events-none" aria-hidden />

      {/* Lapisan 3D */}
      <Suspense fallback={null}>
        <ArScene beats={barCapacity(ex.meter)} getSnapshot={session.getSnapshot} judgement={session.active ? session.judgement : null} reducedMotion={settings.reducedMotion} />
      </Suspense>

      {/* UI */}
      <div className="absolute inset-0 flex flex-col p-3 sm:p-5 safe-bottom">
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-3 !min-h-10 bg-ink-950/60" onClick={exit} aria-label="Keluar dari Arena">
            <X size={20} />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold tracking-[0.2em] text-violet-300">RHYTHM AR ARENA</div>
            <div className="font-bold truncate">{ex.title}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`chip bg-ink-950/60 ${mic.status === 'ready' ? 'text-emerald-200' : 'text-slate-300'}`} title={mic.status === 'ready' ? 'Mikrofon aktif' : 'Mikrofon tidak aktif'}>
              <Mic size={12} /> <span className="hidden sm:inline">{mic.status === 'ready' ? 'Mik aktif' : 'Mik tiada'}</span>
            </span>
            {cam.status === 'on' && track.status === 'running' && (
              <span className="chip bg-ink-950/60 hidden sm:inline-flex">
                <Hand size={12} /> {track.hands}
              </span>
            )}
            {cam.status === 'on' ? (
              <>
                <button className="btn-ghost !px-2.5 !min-h-10 bg-ink-950/60" onClick={() => void cam.flip()} aria-label="Tukar kamera">
                  <SwitchCamera size={18} />
                </button>
                <button
                  className="btn-ghost !px-2.5 !min-h-10 bg-ink-950/60"
                  onClick={() => {
                    cam.stop();
                    setNoCamera(true);
                  }}
                  aria-label="Hentikan kamera"
                >
                  <CameraOff size={18} />
                </button>
              </>
            ) : (
              !intro && (
                <button className="btn-ghost !px-2.5 !min-h-10 bg-ink-950/60" onClick={() => void cam.start('user').then((ok) => setNoCamera(!ok))} aria-label="Hidupkan kamera">
                  <Camera size={18} />
                </button>
              )
            )}
            <button
              className="btn-ghost !px-2.5 !min-h-10 bg-ink-950/60"
              onClick={() => setScale((s) => (s === 'S' ? 'M' : s === 'M' ? 'L' : 'S'))}
              aria-label={`Saiz kad: ${scale}`}
              title="Skala kad irama"
            >
              {scale === 'L' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {/* Kad irama 3D terapung */}
        <div className="mt-3 sm:mt-5 flex justify-center" style={{ perspective: '1100px' }}>
          <div
            className={`w-full ${SCALE_W[scale]} rounded-3xl border border-cyan-300/30 bg-ink-900/80 backdrop-blur-md p-3 sm:p-4 shadow-[0_20px_60px_-10px_rgba(34,211,238,0.35)] transition-[max-width] ${settings.reducedMotion ? '' : 'animate-float'}`}
            style={{ transform: 'rotateX(10deg)', transformStyle: 'preserve-3d' }}
          >
            <div className="flex items-center gap-2 text-xs mb-1.5">
              <span className="chip">{meterLabel(ex.meter)}</span>
              <span className="chip">{ex.tempoBpm} BPM</span>
              <span className="chip hidden sm:inline-flex">{ex.focus}</span>
            </div>
            <RhythmNotation exercise={ex} getMusicTime={getMusicTime} maxBarsPerRow={scale === 'S' ? 2 : 4} />
          </div>
        </div>

        <div className="flex-1" />

        {/* Maklum balas & kawalan */}
        <div className="space-y-3">
          <div className="flex flex-col items-center">
            <JudgementFlash judgement={session.active ? session.judgement : null} combo={session.combo} />
            <BeatIndicator getSnapshot={session.getSnapshot} beatsPerBar={barCapacity(ex.meter)} />
          </div>
          <div className="mx-auto w-full max-w-2xl space-y-2">
            <DemoBanner runMode={session.active ? session.runMode : 'live'} />
            {session.error && <Notice tone="error">{session.error}</Notice>}
            {noCamera && cam.status !== 'on' && !session.active && (
              <Notice tone="warn" icon={<CameraOff size={16} />}>
                {cam.error ?? 'Kamera dimatikan.'} Mod visual alternatif tanpa kamera sedang digunakan — latihan tetap dinilai melalui mikrofon.
              </Notice>
            )}
            {track.error && cam.status === 'on' && <Notice tone="warn">{track.error}</Notice>}
            {mic.status === 'error' && mic.error && !session.active && (
              <Notice tone="error">
                {mic.error.message}{' '}
                <button className="underline font-bold" onClick={() => void mic.request()}>
                  Cuba Lagi
                </button>
              </Notice>
            )}
            <div className="rounded-3xl bg-ink-950/70 backdrop-blur-md border border-white/10 p-3">
              <SessionControls
                phase={session.phase}
                runMode={session.runMode}
                canStartLive={!locked && session.phase !== 'scoring'}
                startLabel="Mula AR"
                onStart={() => startRun('live')}
                onPause={() => void session.pause()}
                onResume={() => void session.resume()}
                onStop={session.stop}
                onExit={exit}
                onTap={session.tap}
              />
              {!session.active && (
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <button className="btn-ghost !min-h-10 !py-2" onClick={() => (example.playingId ? example.stop() : void example.play(ex))}>
                    <Volume2 size={16} /> {example.playingId ? 'Henti Contoh' : 'Dengar Contoh'}
                  </button>
                  {(mic.status === 'error' || !!mic.supportError) && (
                    <button className="btn-ghost !min-h-10 !py-2" onClick={() => startRun('demo-auto')}>
                      <Sparkles size={16} /> Demo (Simulasi)
                    </button>
                  )}
                </div>
              )}
              {locked && <p className="text-center text-sm text-amber-200 mt-2">Tahap {ex.level} masih terkunci — anda boleh mendengar contoh sahaja.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Pengenalan / kebenaran */}
      {intro && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/85 backdrop-blur-sm p-5">
          <div className="card max-w-md p-6 text-center space-y-4 animate-rise">
            <div className="mx-auto size-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
              <Camera size={30} className="text-ink-950" />
            </div>
            <h1 className="text-2xl font-bold">Rhythm AR Arena</h1>
            <p className="text-slate-300 text-sm">
              Kad irama akan terapung di atas paparan kamera anda. Arena memerlukan <b>kamera</b> (paparan & gerakan tangan) dan <b>mikrofon</b> (pengesanan
              tepukan untuk markah). Tiada video atau audio dirakam.
            </p>
            <button className="btn-violet w-full text-lg" onClick={() => void begin(true)} disabled={cam.status === 'starting'}>
              {cam.status === 'starting' ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />} Mulakan Kamera & Mikrofon
            </button>
            <button className="btn-ghost w-full" onClick={() => void begin(false)}>
              Teruskan tanpa kamera (visual alternatif)
            </button>
            <button className="text-sm text-slate-400 underline" onClick={exit}>
              Kembali
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
