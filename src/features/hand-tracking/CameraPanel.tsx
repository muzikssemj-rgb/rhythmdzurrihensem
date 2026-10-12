import { useRef } from 'react';
import { Camera, CameraOff, Hand, Loader2, SwitchCamera } from 'lucide-react';
import { useCamera } from './useCamera';
import { useHandTracking } from './useHandTracking';
import { Notice } from '@/components/ui';
import { useApp } from '@/app/AppStore';

/**
 * Panel kamera pilihan untuk Rhythm Practice: video langsung + overlay titik sendi tangan.
 * Gerakan tepuk dikesan sebagai PENGESAHAN tambahan sahaja (mikrofon kekal sumber utama).
 */
export function CameraPanel({ onGesture, onActiveChange }: { onGesture?: (perfNowMs: number) => void; onActiveChange?: (on: boolean) => void }) {
  const { settings } = useApp();
  const cam = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mirrored = cam.facing === 'user';
  const track = useHandTracking({
    videoRef: cam.videoRef,
    canvasRef,
    enabled: cam.status === 'on',
    drawOverlay: settings.showHandOverlay,
    mirrored,
    onGesture,
  });

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden bg-ink-950 border border-white/10 aspect-video">
        <video
          ref={cam.attach}
          className={`absolute inset-0 size-full object-cover ${cam.status === 'on' ? '' : 'hidden'}`}
          style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
          muted
          playsInline
          aria-label="Paparan kamera langsung"
        />
        <canvas ref={canvasRef} className="absolute inset-0 size-full object-cover pointer-events-none" style={mirrored ? { transform: 'scaleX(-1)' } : undefined} aria-hidden />
        {cam.status !== 'on' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <Camera className="text-violet-300" size={32} />
            <p className="text-sm text-slate-300">Kamera pilihan: lihat pergerakan tangan anda semasa menepuk.</p>
            <button className="btn-violet !min-h-10 !py-2" onClick={() => void cam.start().then((ok) => onActiveChange?.(ok))} disabled={cam.status === 'starting'}>
              {cam.status === 'starting' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Hidupkan Kamera
            </button>
          </div>
        )}
        {cam.status === 'on' && (
          <div className="absolute top-2 left-2 right-2 flex items-center gap-2">
            <span className="chip bg-ink-950/70 text-xs">
              {track.status === 'loading' ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Memuat model tangan…
                </>
              ) : track.status === 'running' ? (
                <>
                  <Hand size={12} /> {track.hands} tangan • {track.gestures} gerakan tepuk
                </>
              ) : track.status === 'error' ? (
                'Pengesanan tangan tidak tersedia'
              ) : null}
            </span>
            <div className="ml-auto flex gap-1.5">
              <button className="btn-ghost !min-h-9 !px-2.5 !py-1 bg-ink-950/70" onClick={() => void cam.flip()} aria-label="Tukar kamera">
                <SwitchCamera size={16} />
              </button>
              <button
                className="btn-ghost !min-h-9 !px-2.5 !py-1 bg-ink-950/70"
                onClick={() => {
                  cam.stop();
                  onActiveChange?.(false);
                }}
                aria-label="Tutup kamera"
              >
                <CameraOff size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      {cam.error && <Notice tone="warn">{cam.error}</Notice>}
      {track.error && <Notice tone="warn">{track.error}</Notice>}
    </div>
  );
}
