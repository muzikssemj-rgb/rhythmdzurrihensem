import type { Exercise, ExpectedEvent, TimelineEvent } from '@/types';
import { barCapacity, buildTimeline, clapEventsWithSustain, secondsPerBeat, toExpectedEvents, totalBeats } from '@/lib/rhythm';
import { scheduleClapSound, scheduleClick } from '@/features/audio-engine/synth';
import type { MicClapInput } from '@/features/audio-engine/micClapInput';

// ============================================================
// Sesi persembahan — semua masa berdasarkan AudioContext.currentTime.
// Detikan kiraan masuk & metronom dijadualkan TERLEBIH DAHULU pada jam audio.
// Jeda = ctx.suspend() → jam audio berhenti, jadual kekal tepat apabila disambung.
// ============================================================

export type SessionMode = 'live' | 'demo-tap' | 'demo-auto';
export type SessionPhase = 'ready' | 'countin' | 'playing' | 'paused' | 'finished' | 'stopped';

export interface SessionOptions {
  exercise: Exercise;
  bpm: number;
  countInBars: 1 | 2;
  metronomeDuringPerformance: boolean;
  metronomeVolume: number;
  latencyOffsetMs: number;
  mode: SessionMode;
  input: MicClapInput | null;
}

export interface SessionSnapshot {
  phase: SessionPhase;
  /** Masa relatif kepada permulaan muzik (negatif semasa kiraan masuk). */
  musicTime: number;
  countInBeatsLeft: number;
  beatIndex: number;
  beatInBar: number;
  progress: number;
}

export class PerformanceSession {
  readonly timeline: TimelineEvent[];
  readonly expected: ExpectedEvent[];
  readonly spb: number;
  readonly beatsPerBar: number;
  readonly countInBeats: number;
  readonly durationSec: number;
  musicStart = 0;
  endTime = 0;
  phase: SessionPhase = 'ready';
  /** Cap masa tepukan mentah (jam audio). */
  readonly rawClaps: number[] = [];
  /** Cap masa gerakan tepuk dari kamera (jam audio, anggaran). */
  readonly cameraClaps: number[] = [];
  private out: GainNode;
  private unsub: (() => void) | null = null;
  private poll: number | null = null;
  private listeners = new Set<(c: number) => void>();
  onFinish: (() => void) | null = null;

  constructor(private ctx: AudioContext, public opts: SessionOptions) {
    this.timeline = buildTimeline(opts.exercise, opts.bpm);
    this.expected = toExpectedEvents(this.timeline);
    this.spb = secondsPerBeat(opts.bpm);
    this.beatsPerBar = barCapacity(opts.exercise.meter);
    this.countInBeats = this.beatsPerBar * opts.countInBars;
    this.durationSec = totalBeats(opts.exercise) * this.spb;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(ctx.destination);
  }

  start() {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.25;
    this.musicStart = t0 + this.countInBeats * this.spb;
    this.endTime = this.musicStart + this.durationSec;
    const vol = this.opts.metronomeVolume;

    // Kiraan masuk
    for (let b = 0; b < this.countInBeats; b++) {
      scheduleClick(ctx, this.out, t0 + b * this.spb, b % this.beatsPerBar === 0, vol);
    }
    // Metronom semasa persembahan (boleh dimatikan untuk Tahap 4)
    if (this.opts.metronomeDuringPerformance) {
      const beats = Math.round(this.durationSec / this.spb);
      for (let b = 0; b < beats; b++) {
        scheduleClick(ctx, this.out, this.musicStart + b * this.spb, b % this.beatsPerBar === 0, vol);
      }
    }

    if (this.opts.mode === 'live' && this.opts.input) {
      const input = this.opts.input;
      input.detector.reset();
      input.enabled = true;
      this.unsub = input.onClap((o) => this.registerClap(o.time));
    }
    if (this.opts.mode === 'demo-auto') this.scheduleAutoDemo();

    this.phase = 'countin';
    this.poll = window.setInterval(() => this.check(), 40);
  }

  /** Tepukan demo (kekunci ruang / butang) — HANYA untuk mod simulasi. */
  tap() {
    if (this.opts.mode !== 'demo-tap') return;
    if (this.phase !== 'countin' && this.phase !== 'playing') return;
    this.registerClap(this.ctx.currentTime);
  }

  addCameraClap(ctxTime: number) {
    if (this.phase === 'countin' || this.phase === 'playing') this.cameraClaps.push(ctxTime);
  }

  private registerClap(t: number) {
    if (this.phase === 'paused' || this.phase === 'finished' || this.phase === 'stopped') return;
    this.rawClaps.push(t);
    const lat = this.opts.mode === 'live' ? this.opts.latencyOffsetMs / 1000 : 0;
    this.listeners.forEach((l) => l(t - this.musicStart - lat));
  }

  onClap(fn: (relTime: number) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Demo automatik: "murid maya" dengan ralat masa deterministik kecil. Dilabel SIMULASI. */
  private scheduleAutoDemo() {
    const claps = this.timeline.filter((e) => e.kind === 'clap');
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const c of claps) {
      const jitter = (rnd() - 0.5) * 0.06; // ±30 ms
      const t = this.musicStart + c.time + jitter;
      scheduleClapSound(this.ctx, this.out, t, 0.7);
      const delay = (t - this.ctx.currentTime) * 1000;
      window.setTimeout(() => this.registerClapAt(t), Math.max(0, delay));
    }
  }

  private registerClapAt(t: number) {
    if (this.phase === 'stopped') return;
    this.rawClaps.push(t);
    this.listeners.forEach((l) => l(t - this.musicStart));
  }

  private check() {
    const now = this.ctx.currentTime;
    if (this.phase === 'countin' && now >= this.musicStart) this.phase = 'playing';
    // Beri masa (½ detik + toleransi) untuk tepukan lewat pada not terakhir
    if ((this.phase === 'playing' || this.phase === 'countin') && now >= this.endTime + Math.max(0.35, this.spb * 0.5)) {
      this.finish();
    }
  }

  snapshot(): SessionSnapshot {
    const now = this.ctx.currentTime;
    const mt = now - this.musicStart;
    const beatPos = mt / this.spb; // boleh negatif
    const beatIndex = Math.floor(beatPos + 1e-6);
    const beatInBar = ((beatIndex % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;
    return {
      phase: this.phase,
      musicTime: mt,
      countInBeatsLeft: mt < 0 ? Math.ceil(-beatPos - 1e-6) : 0,
      beatIndex,
      beatInBar,
      progress: Math.min(1, Math.max(0, mt / this.durationSec)),
    };
  }

  async pause() {
    if (this.phase !== 'countin' && this.phase !== 'playing') return;
    this.prevPhase = this.phase;
    this.phase = 'paused';
    await this.ctx.suspend();
  }
  private prevPhase: SessionPhase = 'playing';

  async resume() {
    if (this.phase !== 'paused') return;
    await this.ctx.resume();
    this.phase = this.prevPhase;
  }

  private finish() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.cleanup(false);
    this.onFinish?.();
  }

  /** Henti & batalkan semua bunyi yang dijadualkan. */
  stop() {
    if (this.phase === 'stopped' || this.phase === 'finished') {
      this.cleanup(true);
      return;
    }
    this.phase = 'stopped';
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.cleanup(true);
  }

  private cleanup(silence: boolean) {
    if (this.poll != null) window.clearInterval(this.poll);
    this.poll = null;
    this.unsub?.();
    this.unsub = null;
    if (silence) {
      try {
        this.out.disconnect();
      } catch {
        /* abaikan */
      }
    }
  }

  /** Tepukan relatif kepada permulaan muzik selepas pampasan latensi. */
  relativeClaps(): number[] {
    const lat = this.opts.mode === 'live' ? this.opts.latencyOffsetMs / 1000 : 0;
    return this.rawClaps.map((t) => t - this.musicStart - lat);
  }

  relativeCameraClaps(): number[] {
    return this.cameraClaps.map((t) => t - this.musicStart);
  }
}

/** Mainkan contoh pola (tepukan sintetik + metronom pilihan). Kembalikan fungsi henti & masa mula. */
export function playExample(
  ctx: AudioContext,
  ex: Exercise,
  bpm: number,
  opts: { withMetronome: boolean; volume: number; metronomeVolume: number; countInBars?: number },
): { stop: () => void; start: number; musicStart: number; end: number } {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const spb = secondsPerBeat(bpm);
  const bpb = barCapacity(ex.meter);
  const countIn = (opts.countInBars ?? 1) * bpb;
  const t0 = ctx.currentTime + 0.15;
  const ms = t0 + countIn * spb;
  for (let b = 0; b < countIn; b++) scheduleClick(ctx, out, t0 + b * spb, b % bpb === 0, opts.metronomeVolume);
  const tl = buildTimeline(ex, bpm);
  const beats = Math.round(totalBeats(ex));
  if (opts.withMetronome) {
    for (let b = 0; b < beats; b++) scheduleClick(ctx, out, ms + b * spb, b % bpb === 0, opts.metronomeVolume * 0.6);
  }
  for (const c of clapEventsWithSustain(tl)) scheduleClapSound(ctx, out, ms + c.time, opts.volume, c.duration);
  return {
    stop: () => {
      try {
        out.disconnect();
      } catch {
        /* abaikan */
      }
    },
    start: t0,
    musicStart: ms,
    end: ms + beats * spb,
  };
}
