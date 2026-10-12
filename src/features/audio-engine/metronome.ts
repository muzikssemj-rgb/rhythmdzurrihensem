import { scheduleClick } from './synth';

// ============================================================
// Metronom bebas (penjadual "lookahead")
// Pemasa JS hanya digunakan untuk MEMBANGUNKAN penjadual; setiap detikan
// dijadualkan tepat pada jam audio (AudioContext.currentTime), jadi
// kelewatan setInterval tidak menjejaskan ketepatan detikan.
// ============================================================

export interface BeatMark {
  time: number;
  beatInBar: number;
  barIndex: number;
}

export class Metronome {
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private gain: GainNode;
  readonly scheduled: BeatMark[] = [];
  bpm: number;
  beatsPerBar: number;
  running = false;
  private lookaheadMs = 25;
  private scheduleAhead = 0.15;

  constructor(private ctx: AudioContext, opts: { bpm: number; beatsPerBar: number; volume?: number }) {
    this.bpm = opts.bpm;
    this.beatsPerBar = opts.beatsPerBar;
    this.gain = ctx.createGain();
    this.gain.gain.value = opts.volume ?? 0.8;
    this.gain.connect(ctx.destination);
  }

  setVolume(v: number) {
    this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
  }

  start(at?: number) {
    if (this.running) return;
    this.running = true;
    this.beat = 0;
    this.nextTime = at ?? this.ctx.currentTime + 0.08;
    this.scheduled.length = 0;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), this.lookaheadMs);
  }

  private tick() {
    while (this.nextTime < this.ctx.currentTime + this.scheduleAhead) {
      const beatInBar = this.beat % this.beatsPerBar;
      scheduleClick(this.ctx, this.gain, this.nextTime, beatInBar === 0, 1);
      this.scheduled.push({ time: this.nextTime, beatInBar, barIndex: Math.floor(this.beat / this.beatsPerBar) });
      if (this.scheduled.length > 64) this.scheduled.shift();
      this.nextTime += 60 / this.bpm;
      this.beat++;
    }
  }

  /** Detik terakhir yang telah berbunyi (untuk penunjuk visual yang diselaraskan dengan jam audio). */
  currentBeat(now = this.ctx.currentTime): BeatMark | null {
    let last: BeatMark | null = null;
    for (const b of this.scheduled) {
      if (b.time <= now) last = b;
      else break;
    }
    return last;
  }

  stop() {
    this.running = false;
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    // Putuskan gain lama supaya detikan yang telah dijadualkan disenyapkan serta-merta
    this.gain.disconnect();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.8;
    this.gain.connect(this.ctx.destination);
  }

  dispose() {
    this.stop();
    this.gain.disconnect();
  }
}
