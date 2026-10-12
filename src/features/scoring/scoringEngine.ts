import type {
  ExpectedEvent,
  ExtraClap,
  HitClass,
  MatchedHit,
  MissedTarget,
  PerformanceCategory,
  ScoreBreakdown,
  ScoringSettings,
  TempoAnalysis,
} from '@/types';

// ============================================================
// ENJIN PENILAIAN POLA IRAMA
// ------------------------------------------------------------
// 1. Padanan SATU-KE-SATU (dynamic programming, mengekalkan susunan)
//    antara peristiwa sasaran (tepuk) dan tepukan sebenar.
//    Kos: tertinggal = 1, tambahan = 1, padanan = |Δt|/tetingkap × 0.9 (< 1)
//    → satu tepukan tidak boleh dipadankan kepada lebih daripada satu sasaran.
// 2. Ketepatan pola  (lalai 40): sasaran dipadankan − penalti tepukan tambahan / semasa rehat.
// 3. Ketepatan masa  (lalai 40): purata kredit masa bagi tepukan yang DIPADANKAN SAHAJA
//    (tepukan tertinggal tidak dihukum dua kali di sini).
//    Pengawal liputan (< 50% not dimainkan) & pengawal tepuk rambang (< 80% tepukan sah)
//    menskalakan markah masa & kestabilan supaya ia tidak boleh "dimain-mainkan".
// 4. Kestabilan tempo(lalai 20): regresi linear masa sebenar vs sasaran —
//    hanyut tempo (kecerunan ≠ 1) + jitter baki. Anjakan malar (cth. latensi) TIDAK
//    dikira sebagai ketidakstabilan, jadi kesilapan tempo dibezakan daripada kesilapan pola.
// ============================================================

export const DEFAULT_SCORING: ScoringSettings = {
  toleranceMs: 120,
  maxWindowMs: 250,
  perfectMs: 45,
  weights: { pattern: 40, timing: 40, stability: 20 },
  extraPenalty: 0.5,
  restPenalty: 0.75,
};

export const DEFAULT_CATEGORIES: PerformanceCategory[] = [
  { min: 90, label: 'Cemerlang' },
  { min: 80, label: 'Sangat Baik' },
  { min: 65, label: 'Baik' },
  { min: 50, label: 'Sedang Menguasai' },
  { min: 0, label: 'Perlu Latihan Tambahan' },
];

const MISS_COST = 1;
const EXTRA_COST = 1;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

export function mergeScoring(base: ScoringSettings, over?: Partial<ScoringSettings>): ScoringSettings {
  if (!over) return base;
  return { ...base, ...over, weights: { ...base.weights, ...(over.weights ?? {}) } };
}

export interface ScoreOptions {
  /** Tempo latihan — untuk menganggar BPM sebenar murid. */
  bpm?: number;
  /** Tamat muzik (saat). Tepukan selepas tamat + tetingkap diabaikan. */
  endTime?: number;
}

function windowsFor(targets: ExpectedEvent[], s: ScoringSettings): number[] {
  const tol = s.toleranceMs / 1000;
  const maxW = Math.max(tol, s.maxWindowMs / 1000);
  return targets.map((t, i) => {
    const prev = i > 0 ? t.time - targets[i - 1]!.time : Infinity;
    const next = i < targets.length - 1 ? targets[i + 1]!.time - t.time : Infinity;
    const halfGap = 0.5 * Math.min(prev, next);
    return Math.max(tol, Math.min(maxW, halfGap));
  });
}

/** Padanan optimum satu-ke-satu yang mengekalkan susunan masa. Dieksport untuk ujian. */
export function matchOneToOne(
  targetTimes: number[],
  windows: number[],
  claps: number[],
): { pairs: [number, number][]; missed: number[]; extras: number[] } {
  const n = targetTimes.length;
  const m = claps.length;
  const W = m + 1;
  const dp = new Float64Array((n + 1) * W);
  const op = new Uint8Array((n + 1) * W); // 1=miss target, 2=extra clap, 3=match
  for (let i = 1; i <= n; i++) {
    dp[i * W] = i * MISS_COST;
    op[i * W] = 1;
  }
  for (let j = 1; j <= m; j++) {
    dp[j] = j * EXTRA_COST;
    op[j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    const tt = targetTimes[i - 1]!;
    const w = windows[i - 1]!;
    for (let j = 1; j <= m; j++) {
      let best = dp[(i - 1) * W + j]! + MISS_COST;
      let o = 1;
      const e = dp[i * W + j - 1]! + EXTRA_COST;
      if (e < best) {
        best = e;
        o = 2;
      }
      const d = Math.abs(claps[j - 1]! - tt);
      if (d <= w + 1e-9) {
        const mc = dp[(i - 1) * W + j - 1]! + (d / w) * 0.9;
        if (mc <= best) {
          best = mc;
          o = 3;
        }
      }
      dp[i * W + j] = best;
      op[i * W + j] = o;
    }
  }
  const pairs: [number, number][] = [];
  const missed: number[] = [];
  const extras: number[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const o = op[i * W + j];
    if (o === 3) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (o === 1) {
      missed.push(i - 1);
      i--;
    } else {
      extras.push(j - 1);
      j--;
    }
  }
  pairs.reverse();
  missed.reverse();
  extras.reverse();
  return { pairs, missed, extras };
}

function classify(deltaMs: number, s: ScoringSettings): HitClass {
  const a = Math.abs(deltaMs);
  if (a <= s.perfectMs) return 'perfect';
  if (a <= s.toleranceMs) return 'ontime';
  return deltaMs < 0 ? 'early' : 'late';
}

function timingCredit(deltaMs: number, windowMs: number, s: ScoringSettings): number {
  const a = Math.abs(deltaMs);
  const p = Math.min(s.perfectMs, s.toleranceMs);
  if (a <= p) return 1;
  if (a <= s.toleranceMs) return 1 - 0.5 * ((a - p) / Math.max(1, s.toleranceMs - p));
  const span = Math.max(1, windowMs - s.toleranceMs);
  return clamp01(0.5 * (1 - (a - s.toleranceMs) / span));
}

export function analyzeTempo(hits: MatchedHit[], bpm?: number): TempoAnalysis {
  if (hits.length < 3) {
    const mean = hits.length ? hits.reduce((a, h) => a + h.deltaMs, 0) / hits.length : 0;
    return { slope: 1, meanOffsetMs: mean, jitterMs: 0, estimatedBpm: bpm ?? 0, trend: 'tidak-cukup-data', sufficientData: false };
  }
  const xs = hits.map((h) => h.targetTime);
  const ys = hits.map((h) => h.clapTime);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let k = 0; k < n; k++) {
    sxx += (xs[k]! - mx) ** 2;
    sxy += (xs[k]! - mx) * (ys[k]! - my);
  }
  if (sxx < 1e-9) {
    return { slope: 1, meanOffsetMs: (my - mx) * 1000, jitterMs: 0, estimatedBpm: bpm ?? 0, trend: 'tidak-cukup-data', sufficientData: false };
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ss = 0;
  for (let k = 0; k < n; k++) ss += (ys[k]! - (slope * xs[k]! + intercept)) ** 2;
  const jitterMs = Math.sqrt(ss / Math.max(1, n - 2)) * 1000;
  const meanOffsetMs = hits.reduce((a, h) => a + h.deltaMs, 0) / n;
  const trend: TempoAnalysis['trend'] = slope > 1.03 ? 'melambat' : slope < 0.97 ? 'melaju' : 'stabil';
  return { slope, meanOffsetMs, jitterMs, estimatedBpm: bpm ? bpm / slope : 0, trend, sufficientData: true };
}

/**
 * Nilai satu persembahan.
 * @param expected peristiwa sasaran (masa dalam saat dari permulaan muzik)
 * @param actualClaps cap masa tepukan sebenar (saat, relatif kepada permulaan muzik, selepas pampasan latensi)
 */
export function scorePerformance(
  expected: ExpectedEvent[],
  actualClaps: number[],
  settings: ScoringSettings = DEFAULT_SCORING,
  opts: ScoreOptions = {},
): ScoreBreakdown {
  const s = settings;
  const targets = expected.filter((e) => e.type === 'clap').sort((a, b) => a.time - b.time);
  const rests = expected.filter((e) => e.type === 'rest');
  const windows = windowsFor(targets, s);
  const maxW = Math.max(s.toleranceMs, s.maxWindowMs) / 1000;

  const lastEnd = expected.reduce((a, e) => Math.max(a, e.time + e.duration), 0);
  const endTime = opts.endTime ?? lastEnd;
  const firstTime = targets.length ? targets[0]!.time : 0;
  const sorted = [...actualClaps].sort((a, b) => a - b);
  // Tepukan semasa kiraan masuk (jauh sebelum not pertama) atau selepas tamat diabaikan.
  const lower = Math.min(firstTime - maxW, -maxW);
  const upper = endTime + maxW;
  const considered: number[] = [];
  let ignored = 0;
  for (const c of sorted) {
    if (c < lower || c > upper) ignored++;
    else considered.push(c);
  }

  const { pairs, missed, extras } = matchOneToOne(
    targets.map((t) => t.time),
    windows,
    considered,
  );

  const hits: MatchedHit[] = pairs.map(([ti, ci]) => {
    const t = targets[ti]!;
    const c = considered[ci]!;
    const deltaMs = (c - t.time) * 1000;
    return {
      targetIndex: ti,
      clapIndex: ci,
      targetTime: t.time,
      clapTime: c,
      deltaMs,
      cls: classify(deltaMs, s),
      timingCredit: timingCredit(deltaMs, windows[ti]! * 1000, s),
    };
  });

  const missedT: MissedTarget[] = missed.map((ti) => {
    const t = targets[ti]!;
    return { targetIndex: ti, time: t.time, bar: t.bar, beatInBar: t.beatInBar };
  });

  const extraC: ExtraClap[] = extras.map((ci) => {
    const time = considered[ci]!;
    const r = rests.find((re) => time >= re.time && time < re.time + re.duration);
    return { clapIndex: ci, time, duringRest: !!r, restEventIndex: r?.index };
  });

  const N = targets.length;
  const restViolations = extraC.filter((e) => e.duringRest).length;
  const extraOther = extraC.length - restViolations;

  // ---- Ketepatan pola
  const patternFrac = N === 0 ? 0 : clamp01((hits.length - s.extraPenalty * extraOther - s.restPenalty * restViolations) / N);

  // Pengawal liputan: jika kurang separuh not dimainkan, markah masa & kestabilan diskalakan
  // supaya murid tidak boleh mendapat markah penuh dengan menepuk satu dua not sahaja.
  const coverage = N === 0 ? 0 : Math.min(1, hits.length / (0.5 * N));
  // Pengawal "tepuk rambang": jika kurang 80% tepukan adalah sah (banyak tepukan tambahan),
  // markah masa & kestabilan turut diskalakan (0 pada ≤ 40%) — menepuk tanpa henti tidak boleh lulus.
  const totalClaps = hits.length + extraC.length;
  const precision = totalClaps === 0 ? 1 : hits.length / totalClaps;
  const spamGuard = clamp01((precision - 0.4) / 0.4);
  const guard = coverage * spamGuard;

  // ---- Ketepatan masa
  const timingFrac = hits.length === 0 ? 0 : (hits.reduce((a, h) => a + h.timingCredit, 0) / hits.length) * guard;

  // ---- Kestabilan tempo
  const tempo = analyzeTempo(hits, opts.bpm);
  let stabilityFrac: number;
  if (!tempo.sufficientData) {
    stabilityFrac = N > 0 && N < 3 && hits.length === N ? 1 : 0;
  } else {
    const drift = clamp01(Math.abs(tempo.slope - 1) / 0.12);
    const jitter = clamp01((tempo.jitterMs - 15) / 70);
    stabilityFrac = clamp01(1 - 0.5 * drift - 0.5 * jitter) * guard;
  }

  const w = s.weights;
  const pattern = round1(w.pattern * patternFrac);
  const timing = round1(w.timing * timingFrac);
  const stability = round1(w.stability * stabilityFrac);
  const maxTotal = w.pattern + w.timing + w.stability;
  const total = maxTotal > 0 ? Math.round(((pattern + timing + stability) / maxTotal) * 100) : 0;

  // ---- Kombo (berturut-turut tepat pada masanya)
  const hitByTarget = new Map(hits.map((h) => [h.targetIndex, h]));
  let combo = 0;
  let maxCombo = 0;
  for (let i = 0; i < N; i++) {
    const h = hitByTarget.get(i);
    if (h && (h.cls === 'perfect' || h.cls === 'ontime')) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
    } else combo = 0;
  }

  return {
    total,
    pattern,
    timing,
    stability,
    max: { ...w },
    hits,
    missed: missedT,
    extras: extraC,
    counts: {
      targets: N,
      hits: hits.length,
      perfect: hits.filter((h) => h.cls === 'perfect').length,
      onTime: hits.filter((h) => h.cls === 'perfect' || h.cls === 'ontime').length,
      early: hits.filter((h) => h.cls === 'early').length,
      late: hits.filter((h) => h.cls === 'late').length,
      missed: missedT.length,
      extra: extraOther,
      restViolations,
      ignored,
    },
    tempo,
    maxCombo,
  };
}

export function getCategory(total: number, cats: PerformanceCategory[] = DEFAULT_CATEGORIES): string {
  const sorted = [...cats].sort((a, b) => b.min - a.min);
  return sorted.find((c) => total >= c.min)?.label ?? sorted[sorted.length - 1]?.label ?? '';
}

export function computeStars(total: number, passMark: number): number {
  if (total < passMark) return 0;
  if (total >= 92) return 3;
  if (total >= Math.max(80, passMark + 10)) return 2;
  return 1;
}
