import { useEffect, useRef, useState, type RefObject } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { HAND_CONNECTIONS, loadHandLandmarker } from './handTracker';
import { ClapGestureDetector } from './clapGesture';

export type TrackerStatus = 'idle' | 'loading' | 'running' | 'error';

/**
 * Jalankan MediaPipe Hand Landmarker pada video kamera (~20–30 fps, dihadkan supaya
 * audio & metronom tidak terganggu — semua masa audio dijadualkan pada jam audio,
 * bukan pada bingkai skrin).
 */
export function useHandTracking(opts: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
  drawOverlay: boolean;
  mirrored: boolean;
  onGesture?: (perfNowMs: number) => void;
  maxFps?: number;
}) {
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hands, setHands] = useState(0);
  const [gestures, setGestures] = useState(0);
  const cb = useRef(opts.onGesture);
  cb.current = opts.onGesture;
  const drawRef = useRef(opts.drawOverlay);
  drawRef.current = opts.drawOverlay;

  useEffect(() => {
    if (!opts.enabled) {
      setStatus('idle');
      setHands(0);
      return;
    }
    let alive = true;
    let raf = 0;
    let lm: HandLandmarker | null = null;
    const det = new ClapGestureDetector();
    let lastRun = 0;
    let lastVideoTime = -1;
    let flashUntil = 0;
    const minGap = 1000 / (opts.maxFps ?? 24);
    setStatus('loading');
    setError(null);

    loadHandLandmarker()
      .then((l) => {
        if (!alive) return;
        lm = l;
        setStatus('running');
        loop();
      })
      .catch((e: unknown) => {
        console.warn('[HandTracking]', e);
        if (!alive) return;
        setStatus('error');
        setError(
          navigator.onLine
            ? 'Model pengesanan tangan tidak dapat dimuatkan pada peranti ini. Latihan mikrofon tetap berfungsi.'
            : 'Pengesanan tangan memerlukan Internet untuk memuat turun model kali pertama. Latihan mikrofon tetap berfungsi.',
        );
      });

    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const v = opts.videoRef.current;
      const c = opts.canvasRef.current;
      const now = performance.now();
      if (!lm || !v || v.readyState < 2 || now - lastRun < minGap) return;
      if (v.currentTime === lastVideoTime) return;
      lastVideoTime = v.currentTime;
      lastRun = now;
      let res;
      try {
        res = lm.detectForVideo(v, now);
      } catch {
        return;
      }
      const handsLm = res.landmarks ?? [];
      setHands((h) => (h === handsLm.length ? h : handsLm.length));
      if (det.update(handsLm, now)) {
        flashUntil = now + 220;
        setGestures((g) => g + 1);
        cb.current?.(now);
      }
      if (c) {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const g = c.getContext('2d');
        if (!g) return;
        g.clearRect(0, 0, w, h);
        if (!drawRef.current) return;
        const flashing = now < flashUntil;
        for (const hand of handsLm) {
          g.lineWidth = Math.max(2, w / 260);
          g.strokeStyle = flashing ? 'rgba(252,211,77,0.95)' : 'rgba(34,211,238,0.85)';
          g.beginPath();
          for (const [a, b] of HAND_CONNECTIONS) {
            const pa = hand[a];
            const pb = hand[b];
            if (!pa || !pb) continue;
            g.moveTo(pa.x * w, pa.y * h);
            g.lineTo(pb.x * w, pb.y * h);
          }
          g.stroke();
          g.fillStyle = flashing ? '#fde68a' : '#a78bfa';
          for (const p of hand) {
            g.beginPath();
            g.arc(p.x * w, p.y * h, Math.max(3, w / 180), 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    };

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      const c = opts.canvasRef.current;
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled]);

  return { status, error, hands, gestures };
}
