import { describe, expect, it } from 'vitest';
import { ClapDetector, FeatureExtractor, type FeatureFrame } from './clapDetectionEngine';
import { analyzeNoise, estimateLatency, recommendThreshold } from './audioCalibration';

// ------------------------------------------------------------
// Isyarat sintetik: tepukan = letusan hingar jalur lebar dengan reput eksponen (~8 ms)
// Ini ujian algoritma; ujian pada peranti sebenar masih diperlukan (lihat README).
// ------------------------------------------------------------
const SR = 48000;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
}

interface Synth {
  dur: number;
  claps?: { t: number; amp: number }[];
  noiseAmp?: number;
  echo?: { delay: number; gain: number };
  sine?: { freq: number; amp: number; times: number[] };
  hum?: { freq: number; amp: number };
}

function synth(o: Synth): Float32Array {
  const n = Math.floor(o.dur * SR);
  const x = new Float32Array(n);
  const r = rng(42);
  const r2 = rng(99);
  for (let i = 0; i < n; i++) x[i] = (o.noiseAmp ?? 0) * r();
  const addClap = (t: number, amp: number) => {
    const s0 = Math.floor(t * SR);
    for (let i = 0; i < SR * 0.06 && s0 + i < n; i++) x[s0 + i]! += amp * r2() * Math.exp(-i / (SR * 0.008));
  };
  for (const c of o.claps ?? []) {
    addClap(c.t, c.amp);
    if (o.echo) addClap(c.t + o.echo.delay, c.amp * o.echo.gain);
  }
  if (o.sine) {
    for (const t of o.sine.times) {
      const s0 = Math.floor(t * SR);
      for (let i = 0; i < SR * 0.09 && s0 + i < n; i++) {
        const env = Math.min(1, i / (SR * 0.004)) * Math.exp(-i / (SR * 0.025));
        x[s0 + i]! += o.sine.amp * env * Math.sin((2 * Math.PI * o.sine.freq * i) / SR);
      }
    }
  }
  if (o.hum) for (let i = 0; i < n; i++) x[i]! += o.hum.amp * Math.sin((2 * Math.PI * o.hum.freq * i) / SR);
  return x;
}

function detect(frames: FeatureFrame[], det = new ClapDetector()) {
  return frames.map((f) => det.process(f)).filter((o) => o !== null);
}

const frames = (x: Float32Array) => new FeatureExtractor(SR).all(x);

describe('ClapDetector', () => {
  const times = [0.5, 1.0, 1.5, 2.0];

  it('mengesan tepukan kuat dengan cap masa tepat (±5 ms)', () => {
    const on = detect(frames(synth({ dur: 2.5, claps: times.map((t) => ({ t, amp: 0.8 })), noiseAmp: 0.002 })));
    expect(on).toHaveLength(4);
    on.forEach((o, i) => expect(Math.abs(o!.time - times[i]!)).toBeLessThan(0.005));
  });

  it('mengesan tepukan perlahan', () => {
    const on = detect(frames(synth({ dur: 2.5, claps: times.map((t) => ({ t, amp: 0.05 })), noiseAmp: 0.002 })));
    expect(on).toHaveLength(4);
  });

  it('mengesan campuran tepukan kuat & perlahan', () => {
    const on = detect(frames(synth({ dur: 2.5, claps: times.map((t, i) => ({ t, amp: i % 2 ? 0.06 : 0.9 })), noiseAmp: 0.002 })));
    expect(on).toHaveLength(4);
  });

  it('tidak mengira gema sebagai tepukan baharu', () => {
    const on = detect(frames(synth({ dur: 2.5, claps: times.map((t) => ({ t, amp: 0.8 })), echo: { delay: 0.045, gain: 0.5 }, noiseAmp: 0.002 })));
    expect(on).toHaveLength(4);
  });

  it('mengesan tepukan berganda pantas (semikuaver ~136 ms)', () => {
    const fast = [0.5, 0.636, 0.773, 0.909];
    const on = detect(frames(synth({ dur: 1.4, claps: fast.map((t) => ({ t, amp: 0.6 })), noiseAmp: 0.002 })));
    expect(on).toHaveLength(4);
  });

  it('tidak mencetuskan pada hingar latar berterusan', () => {
    const on = detect(frames(synth({ dur: 3, noiseAmp: 0.05 })));
    expect(on).toHaveLength(0);
  });

  it('tidak mencetuskan pada detikan metronom (sinus 660/880 Hz) yang bocor', () => {
    const on = detect(frames(synth({ dur: 3, noiseAmp: 0.002, sine: { freq: 660, amp: 0.5, times: [0.5, 1, 1.5, 2, 2.5] } })));
    expect(on).toHaveLength(0);
  });

  it('tidak mencetuskan pada dengung frekuensi rendah (suara/kipas)', () => {
    const on = detect(frames(synth({ dur: 3, noiseAmp: 0.002, hum: { freq: 180, amp: 0.4 } })));
    expect(on).toHaveLength(0);
  });

  it('masih mengesan tepukan dalam persekitaran bising (ambang dinamik)', () => {
    const on = detect(frames(synth({ dur: 3, claps: [1, 1.5, 2, 2.5].map((t) => ({ t, amp: 0.7 })), noiseAmp: 0.03 })));
    expect(on).toHaveLength(4);
  });

  it('tempoh refraktori boleh dilaraskan', () => {
    const two = [0.5, 0.56];
    const loose = detect(frames(synth({ dur: 1, claps: two.map((t) => ({ t, amp: 0.8 })), noiseAmp: 0.002 })), new ClapDetector({ refractoryMs: 40 }));
    const strict = detect(frames(synth({ dur: 1, claps: two.map((t) => ({ t, amp: 0.8 })), noiseAmp: 0.002 })), new ClapDetector({ refractoryMs: 100 }));
    expect(loose).toHaveLength(2);
    expect(strict).toHaveLength(1);
  });
});

describe('kalibrasi', () => {
  it('mengukur hingar dan mencadangkan ambang di antara hingar dan tepukan', () => {
    const noise = analyzeNoise(frames(synth({ dur: 1.5, noiseAmp: 0.01 })));
    const rec = recommendThreshold(noise, frames(synth({ dur: 3, claps: [0.5, 1.1, 1.7, 2.3].map((t) => ({ t, amp: 0.5 })), noiseAmp: 0.01 })));
    expect(rec.clapsFound).toBe(4);
    expect(rec.thresholdDb).toBeGreaterThan(noise.p95Db);
    expect(rec.quality).not.toBe('lemah');
    // Detector dengan ambang ini mengesan semua tepukan
    const det = new ClapDetector({ calibratedThresholdDb: rec.thresholdDb }, noise.medianDb);
    expect(detect(frames(synth({ dur: 3, claps: [0.5, 1.1, 1.7, 2.3].map((t) => ({ t, amp: 0.3 })), noiseAmp: 0.01 })), det)).toHaveLength(4);
  });

  it('melaporkan kualiti lemah apabila tiada tepukan', () => {
    const noise = analyzeNoise(frames(synth({ dur: 1, noiseAmp: 0.01 })));
    const rec = recommendThreshold(noise, frames(synth({ dur: 2, noiseAmp: 0.01 })));
    expect(rec.clapsFound).toBe(0);
    expect(rec.quality).toBe('lemah');
  });

  it('anggaran latensi menggunakan median (tahan outlier)', () => {
    const clicks = [1, 2, 3, 4, 5, 6, 7, 8];
    const claps = clicks.map((c, i) => c + (i === 3 ? 0.25 : 0.08 + (i % 2 ? 0.01 : -0.01)));
    const l = estimateLatency(claps, clicks);
    expect(l.offsetMs).toBeGreaterThan(65);
    expect(l.offsetMs).toBeLessThan(95);
    expect(l.reliable).toBe(true);
  });
});
