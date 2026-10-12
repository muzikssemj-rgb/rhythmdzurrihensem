import { useEffect, useRef, useState } from 'react';
import { Minus, Play, Plus, Square } from 'lucide-react';
import { Metronome } from './metronome';
import { ensureAudioRunning } from './audioContext';
import { TEMPO_MAX, TEMPO_MIN } from '@/lib/rhythm';

/** Metronom bebas (penjadual lookahead pada jam audio) dengan penunjuk detik visual. */
export function MetronomeTool({ volume }: { volume: number }) {
  const [bpm, setBpm] = useState(80);
  const [beats, setBeats] = useState(4);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const m = useRef<Metronome | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    m.current?.setBpm(bpm);
  }, [bpm]);
  useEffect(() => {
    if (m.current) m.current.beatsPerBar = beats;
  }, [beats]);
  useEffect(() => {
    m.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const b = m.current?.currentBeat();
      setBeat(b ? b.beatInBar : -1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => () => m.current?.dispose(), []);

  const toggle = async () => {
    if (running) {
      m.current?.stop();
      setRunning(false);
      setBeat(-1);
      return;
    }
    const ctx = await ensureAudioRunning();
    if (!m.current || ctxRef.current !== ctx) {
      m.current?.dispose();
      m.current = new Metronome(ctx, { bpm, beatsPerBar: beats, volume });
      ctxRef.current = ctx;
    }
    m.current.setVolume(volume);
    m.current.start();
    setRunning(true);
  };

  const clamp = (v: number) => Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, v));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <button className="btn-ghost !px-3" onClick={() => setBpm((b) => clamp(b - 1))} aria-label="Kurangkan tempo">
          <Minus size={18} />
        </button>
        <div className="text-center w-28">
          <div className="font-display text-5xl font-bold">{bpm}</div>
          <div className="text-xs text-slate-400 font-bold">BPM</div>
        </div>
        <button className="btn-ghost !px-3" onClick={() => setBpm((b) => clamp(b + 1))} aria-label="Tambah tempo">
          <Plus size={18} />
        </button>
      </div>
      <input type="range" min={TEMPO_MIN} max={TEMPO_MAX} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full accent-cyan-400" aria-label="Tempo BPM" />
      <div className="flex justify-center gap-3" aria-hidden>
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={`size-6 rounded-full border-2 transition-all duration-75 ${i === beat ? (i === 0 ? 'bg-gold-300 border-gold-300 scale-125' : 'bg-cyan-300 border-cyan-300 scale-125') : 'border-white/25'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[2, 3, 4].map((b) => (
          <button key={b} className={b === beats ? 'btn-primary !min-h-10 !py-2' : 'btn-ghost !min-h-10 !py-2'} onClick={() => setBeats(b)} aria-pressed={b === beats}>
            {b}/4
          </button>
        ))}
        <button className={running ? 'btn-danger' : 'btn-primary'} onClick={() => void toggle()}>
          {running ? <Square size={18} /> : <Play size={18} />} {running ? 'Henti' : 'Mula'}
        </button>
      </div>
    </div>
  );
}
