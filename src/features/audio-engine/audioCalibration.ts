import { toDb, type FeatureFrame } from './clapDetectionEngine';

// ============================================================
// Analisis kalibrasi (fungsi tulen — diuji dengan Vitest)
// ============================================================

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return -90;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx]!;
}

export interface NoiseProfile {
  medianDb: number;
  p95Db: number;
  frames: number;
}

/** Ukur aras bunyi latar (jalur tinggi). */
export function analyzeNoise(frames: FeatureFrame[]): NoiseProfile {
  const dbs = frames.map((f) => toDb(f.hiEnergy)).sort((a, b) => a - b);
  return { medianDb: percentile(dbs, 50), p95Db: percentile(dbs, 95), frames: frames.length };
}

export interface Peak {
  time: number;
  db: number;
}

/** Cari puncak tempatan di atas minDb, dipisahkan sekurang-kurangnya minGapMs. */
export function findPeaks(frames: FeatureFrame[], minDb: number, minGapMs = 120): Peak[] {
  const peaks: Peak[] = [];
  const dbs = frames.map((f) => toDb(f.hiEnergy));
  for (let i = 0; i < frames.length; i++) {
    const d = dbs[i]!;
    if (d < minDb) continue;
    const prev = i > 0 ? dbs[i - 1]! : -Infinity;
    const next = i < dbs.length - 1 ? dbs[i + 1]! : -Infinity;
    if (d < prev || d < next) continue;
    const last = peaks[peaks.length - 1];
    if (last && (frames[i]!.time - last.time) * 1000 < minGapMs) {
      if (d > last.db) peaks[peaks.length - 1] = { time: frames[i]!.time, db: d };
      continue;
    }
    peaks.push({ time: frames[i]!.time, db: d });
  }
  return peaks;
}

export interface ThresholdRecommendation {
  thresholdDb: number;
  snrDb: number;
  quality: 'baik' | 'sederhana' | 'lemah';
  clapsFound: number;
  message: string;
}

/** Cadangkan ambang berdasarkan hingar latar dan puncak tepukan ujian. */
export function recommendThreshold(noise: NoiseProfile, clapFrames: FeatureFrame[], expectedClaps = 4): ThresholdRecommendation {
  const peaks = findPeaks(clapFrames, noise.p95Db + 6, 150)
    .sort((a, b) => b.db - a.db)
    .slice(0, Math.max(expectedClaps * 2, expectedClaps));
  if (peaks.length === 0) {
    return {
      thresholdDb: noise.p95Db + 10,
      snrDb: 0,
      quality: 'lemah',
      clapsFound: 0,
      message: 'Tiada tepukan dikesan. Tepuk lebih kuat atau dekatkan peranti, kemudian cuba lagi.',
    };
  }
  // Ambil "expectedClaps" puncak terkuat sebagai tepukan sebenar
  const clapPeaks = peaks.slice(0, expectedClaps).map((p) => p.db).sort((a, b) => a - b);
  const minPeak = clapPeaks[0]!;
  const median = clapPeaks[Math.floor(clapPeaks.length / 2)]!;
  const snrDb = median - noise.p95Db;
  const floor = noise.p95Db + 8;
  const thresholdDb = Math.max(floor, minPeak - 12);
  const quality: ThresholdRecommendation['quality'] = snrDb >= 25 ? 'baik' : snrDb >= 14 ? 'sederhana' : 'lemah';
  const found = Math.min(peaks.length, expectedClaps);
  const message =
    quality === 'baik'
      ? 'Kalibrasi berjaya. Tepukan jelas berbanding bunyi latar.'
      : quality === 'sederhana'
        ? 'Kalibrasi berjaya, tetapi persekitaran agak bising. Tepuk dengan jelas.'
        : 'Bunyi latar hampir sekuat tepukan. Cuba di tempat lebih senyap atau tepuk lebih kuat.';
  return { thresholdDb, snrDb, quality, clapsFound: found, message };
}

export interface LatencyEstimate {
  offsetMs: number;
  spreadMs: number;
  matched: number;
  reliable: boolean;
}

/**
 * Anggar latensi gabungan (output metronom + input mikrofon + masa tindak balas purata)
 * daripada tepukan murid bersama detikan metronom. Menggunakan median supaya tahan outlier.
 */
export function estimateLatency(clapTimes: number[], clickTimes: number[], windowMs = 300): LatencyEstimate {
  const offsets: number[] = [];
  const used = new Set<number>();
  for (const k of clickTimes) {
    let best = -1;
    let bestD = Infinity;
    clapTimes.forEach((c, i) => {
      if (used.has(i)) return;
      const d = Math.abs(c - k);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0 && bestD * 1000 <= windowMs) {
      used.add(best);
      offsets.push((clapTimes[best]! - k) * 1000);
    }
  }
  if (offsets.length === 0) return { offsetMs: 0, spreadMs: 0, matched: 0, reliable: false };
  const sorted = [...offsets].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)]!;
  const mad = [...offsets.map((o) => Math.abs(o - med))].sort((a, b) => a - b)[Math.floor(offsets.length / 2)]!;
  const reliable = offsets.length >= Math.min(6, Math.ceil(clickTimes.length * 0.6)) && mad < 60;
  return { offsetMs: Math.max(-250, Math.min(250, med)), spreadMs: mad, matched: offsets.length, reliable };
}
