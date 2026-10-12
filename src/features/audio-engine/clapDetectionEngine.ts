// ============================================================
// ENJIN PENGESANAN TEPUKAN (tulen, tanpa DOM — boleh diuji)
// ------------------------------------------------------------
// Input: "frame" ciri audio setiap blok 128 sampel (~2.7 ms @48 kHz):
//   - tenaga jalur tinggi (selepas penapis high-pass 4-tertib ~2.5 kHz)
//   - tenaga penuh & puncak
// Tepukan ialah bunyi transien jalur lebar dengan tenaga tinggi > 2 kHz,
// manakala detikan metronom (sinus 660/880 Hz), suara dan dengung kipas
// kebanyakannya di bawah jalur ini.
//
// Algoritma onset:
//   1. Anggaran aras hingar (noise floor) adaptif — turun pantas, naik perlahan.
//   2. Ambang dinamik = max(ambang kalibrasi, hingar + margin) dilaras sensitiviti.
//   3. Syarat "kenaikan" — tenaga mesti melonjak ≥ riseDb berbanding purata ~20 ms
//      sebelumnya (menolak bunyi berterusan yang perlahan-lahan menjadi kuat).
//   4. Pintu gema — selepas tepukan, puncak baharu mesti melepasi sampul
//      yang mereput daripada puncak sebelumnya (menolak gema/pantulan).
//   5. Tempoh refraktori + histeresis (mesti turun di bawah ambang sebelum bersedia semula).
// ============================================================

export interface FeatureFrame {
  /** Masa AudioContext (saat) bagi permulaan blok. */
  time: number;
  /** Purata kuasa dua isyarat jalur tinggi. */
  hiEnergy: number;
  /** Purata kuasa dua isyarat penuh. */
  fullEnergy: number;
  /** Puncak mutlak isyarat penuh. */
  peak: number;
}

export interface ClapOnset {
  time: number;
  energyDb: number;
  thresholdDb: number;
}

export interface ClapDetectorConfig {
  refractoryMs: number;
  /** Ambang mutlak minimum (dB). */
  minThresholdDb: number;
  /** Margin di atas aras hingar (dB). */
  noiseMarginDb: number;
  /** Kenaikan minimum berbanding purata sejurus sebelum (dB). */
  riseDb: number;
  /** Kadar reput pintu gema (dB setiap ms). */
  echoDecayDbPerMs: number;
  /** Margin pintu gema di bawah puncak sebelumnya (dB). */
  echoMarginDb: number;
  /** Ambang hasil kalibrasi (dB) — null jika belum dikalibrasi. */
  calibratedThresholdDb: number | null;
  /** 0.25–4. >1 lebih sensitif (ambang diturunkan 6 dB bagi setiap gandaan). */
  sensitivity: number;
  /** Bilangan frame untuk purata asas (baseline). */
  baselineFrames: number;
  /** Frame awal untuk mempelajari hingar sebelum pengesanan bermula (~100 ms). */
  warmupFrames: number;
}

export const DEFAULT_DETECTOR_CONFIG: ClapDetectorConfig = {
  refractoryMs: 70,
  minThresholdDb: -72,
  noiseMarginDb: 14,
  riseDb: 9,
  echoDecayDbPerMs: 0.2,
  echoMarginDb: 6,
  calibratedThresholdDb: null,
  sensitivity: 1,
  baselineFrames: 8,
  warmupFrames: 36,
};

export const toDb = (energy: number) => 10 * Math.log10(energy + 1e-12);

export class ClapDetector {
  cfg: ClapDetectorConfig;
  noiseDb: number;
  private ring: number[] = [];
  private armed = true;
  private lastOnsetTime = -Infinity;
  private lastPeakDb = -Infinity;
  private peakTrackUntil = -Infinity;
  private framesSeen = 0;

  constructor(cfg: Partial<ClapDetectorConfig> = {}, initialNoiseDb?: number) {
    this.cfg = { ...DEFAULT_DETECTOR_CONFIG, ...cfg };
    this.noiseDb = initialNoiseDb ?? -80;
  }

  configure(cfg: Partial<ClapDetectorConfig>) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  reset() {
    this.ring = [];
    this.armed = true;
    this.lastOnsetTime = -Infinity;
    this.lastPeakDb = -Infinity;
    this.peakTrackUntil = -Infinity;
  }

  /** Ambang semasa (dB). */
  currentThresholdDb(): number {
    const sensAdj = 6 * Math.log2(Math.min(4, Math.max(0.25, this.cfg.sensitivity)));
    const dyn = this.noiseDb + this.cfg.noiseMarginDb;
    const base = this.cfg.calibratedThresholdDb != null ? Math.max(this.cfg.calibratedThresholdDb, dyn) : dyn;
    return Math.max(this.cfg.minThresholdDb, base - sensAdj);
  }

  process(f: FeatureFrame): ClapOnset | null {
    const e = toDb(f.hiEnergy);
    this.framesSeen++;
    if (this.framesSeen <= this.cfg.warmupFrames) {
      // Fasa panas: belajar aras hingar dengan pantas, tiada pengesanan
      this.noiseDb = this.framesSeen === 1 ? e : this.noiseDb + (e - this.noiseDb) * 0.15;
      this.ring.push(f.hiEnergy);
      if (this.ring.length > this.cfg.baselineFrames) this.ring.shift();
      return null;
    }
    const th = this.currentThresholdDb();

    // Purata asas (linear) bagi frame sebelumnya
    let baseDb = -120;
    if (this.ring.length) {
      const mean = this.ring.reduce((a, b) => a + b, 0) / this.ring.length;
      baseDb = toDb(mean);
    }
    this.ring.push(f.hiEnergy);
    if (this.ring.length > this.cfg.baselineFrames) this.ring.shift();

    const sinceMs = (f.time - this.lastOnsetTime) * 1000;

    // Jejak puncak sejurus selepas onset (untuk pintu gema)
    if (f.time <= this.peakTrackUntil && e > this.lastPeakDb) this.lastPeakDb = e;

    // Histeresis: bersedia semula hanya selepas tenaga turun di bawah ambang
    if (!this.armed && e < th - 3 && sinceMs >= this.cfg.refractoryMs) this.armed = true;

    let onset: ClapOnset | null = null;
    if (this.armed && sinceMs >= this.cfg.refractoryMs && e >= th && e - baseDb >= this.cfg.riseDb) {
      const echoGate = Number.isFinite(this.lastPeakDb)
        ? this.lastPeakDb - this.cfg.echoMarginDb - this.cfg.echoDecayDbPerMs * sinceMs
        : -Infinity;
      if (e >= echoGate) {
        onset = { time: f.time, energyDb: e, thresholdDb: th };
        this.lastOnsetTime = f.time;
        this.lastPeakDb = e;
        this.peakTrackUntil = f.time + 0.02;
        this.armed = false;
      }
    }

    // Kemas kini aras hingar hanya bila tiada aktiviti tepukan
    if (!onset && this.armed && e < th) {
      const k = e < this.noiseDb ? 0.05 : 0.002;
      this.noiseDb += (e - this.noiseDb) * k;
    }
    return onset;
  }
}

// ------------------------------------------------------------
// Penapis high-pass (RBJ biquad) — pekali dikongsi dengan AudioWorklet
// ------------------------------------------------------------
export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export function designHighpass(fc: number, sampleRate: number, q = Math.SQRT1_2): BiquadCoeffs {
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

export const HIGHPASS_HZ = 2500;
export const BLOCK = 128;

/** Pengiraan ciri dalam JS (digunakan oleh ujian & laluan sandaran ScriptProcessor). */
export class FeatureExtractor {
  private c: BiquadCoeffs;
  private s = [0, 0, 0, 0, 0, 0, 0, 0]; // x1,x2,y1,y2 untuk dua peringkat
  constructor(public sampleRate: number) {
    this.c = designHighpass(HIGHPASS_HZ, sampleRate);
  }
  block(samples: Float32Array | number[], start: number, len: number, time: number): FeatureFrame {
    const { b0, b1, b2, a1, a2 } = this.c;
    const s = this.s;
    let hi = 0;
    let full = 0;
    let peak = 0;
    for (let i = start; i < start + len; i++) {
      const x = samples[i] ?? 0;
      // peringkat 1
      const y = b0 * x + b1 * s[0]! + b2 * s[1]! - a1 * s[2]! - a2 * s[3]!;
      s[1] = s[0]!;
      s[0] = x;
      s[3] = s[2]!;
      s[2] = y;
      // peringkat 2
      const z = b0 * y + b1 * s[4]! + b2 * s[5]! - a1 * s[6]! - a2 * s[7]!;
      s[5] = s[4]!;
      s[4] = y;
      s[7] = s[6]!;
      s[6] = z;
      hi += z * z;
      full += x * x;
      const a = Math.abs(x);
      if (a > peak) peak = a;
    }
    return { time, hiEnergy: hi / len, fullEnergy: full / len, peak };
  }
  /** Proses keseluruhan buffer kepada frame. */
  all(samples: Float32Array | number[], t0 = 0): FeatureFrame[] {
    const out: FeatureFrame[] = [];
    for (let i = 0; i + BLOCK <= samples.length; i += BLOCK) {
      out.push(this.block(samples, i, BLOCK, t0 + i / this.sampleRate));
    }
    return out;
  }
}

/** Kod AudioWorklet (dimuatkan melalui Blob URL — tiada fail berasingan diperlukan). */
export const CLAP_WORKLET_SOURCE = /* js */ `
class ClapFeatureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const c = options.processorOptions.coeffs;
    this.c = c;
    this.s = new Float64Array(8);
    this.buf = [];
    this.batch = options.processorOptions.batch || 6;
    this.running = true;
    this.port.onmessage = (e) => { if (e.data === 'stop') this.running = false; };
  }
  process(inputs) {
    if (!this.running) return false;
    const input = inputs[0];
    const ch = input && input[0];
    if (!ch) return true;
    const c = this.c, s = this.s;
    let hi = 0, full = 0, peak = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const y = c.b0 * x + c.b1 * s[0] + c.b2 * s[1] - c.a1 * s[2] - c.a2 * s[3];
      s[1] = s[0]; s[0] = x; s[3] = s[2]; s[2] = y;
      const z = c.b0 * y + c.b1 * s[4] + c.b2 * s[5] - c.a1 * s[6] - c.a2 * s[7];
      s[5] = s[4]; s[4] = y; s[7] = s[6]; s[6] = z;
      hi += z * z; full += x * x;
      const a = x < 0 ? -x : x; if (a > peak) peak = a;
    }
    this.buf.push(currentTime, hi / ch.length, full / ch.length, peak);
    if (this.buf.length >= this.batch * 4) {
      this.port.postMessage(Float64Array.from(this.buf));
      this.buf = [];
    }
    return true;
  }
}
registerProcessor('clap-feature-processor', ClapFeatureProcessor);
`;
