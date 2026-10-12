import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORING, computeStars, getCategory, matchOneToOne, scorePerformance } from './scoringEngine';
import { buildTimeline, parseRhythmText, toExpectedEvents } from '@/lib/rhythm';
import type { Exercise } from '@/types';

const mk = (rhythm: string, bpm = 60, beats: 2 | 3 | 4 = 4): Exercise => ({
  id: 't',
  title: 'T',
  level: 1,
  meter: { beats, beatUnit: 4 },
  tempoBpm: bpm,
  bars: parseRhythmText(rhythm),
  passMark: 60,
  description: '',
  focus: '',
});

const expectedOf = (ex: Exercise) => toExpectedEvents(buildTimeline(ex));
const clapTimes = (ex: Exercise) => expectedOf(ex).filter((e) => e.type === 'clap').map((e) => e.time);

describe('scoringEngine — pemadanan satu-ke-satu', () => {
  it('tidak memadankan dua tepukan kepada satu sasaran', () => {
    const r = matchOneToOne([1.0], [0.12], [0.98, 1.02]);
    expect(r.pairs).toHaveLength(1);
    expect(r.extras).toHaveLength(1);
  });
  it('mengekalkan susunan & memilih padanan optimum', () => {
    const r = matchOneToOne([0, 0.5, 1.0], [0.12, 0.12, 0.12], [0.02, 0.55, 0.97]);
    expect(r.pairs).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });
});

describe('scoringEngine — senario markah', () => {
  const ex = mk('q q q q | q q q q', 60);
  const exp = expectedOf(ex);
  const perfect = clapTimes(ex);

  it('tepukan sempurna → markah tinggi (100)', () => {
    const r = scorePerformance(exp, perfect, DEFAULT_SCORING, { bpm: 60 });
    expect(r.total).toBe(100);
    expect(r.counts.hits).toBe(8);
    expect(r.counts.perfect).toBe(8);
    expect(r.counts.missed).toBe(0);
    expect(r.counts.extra).toBe(0);
    expect(r.maxCombo).toBe(8);
  });

  it('tepukan terlalu awal mengurangkan markah masa dan dikelaskan "early"', () => {
    const claps = perfect.map((t, i) => (i % 2 === 0 ? t - 0.16 : t));
    const r = scorePerformance(exp, claps, DEFAULT_SCORING, { bpm: 60 });
    expect(r.counts.early).toBe(4);
    expect(r.timing).toBeLessThan(40);
    expect(r.pattern).toBe(40); // pola masih betul — tidak dihukum dua kali
  });

  it('tepukan lewat dikesan', () => {
    const claps = perfect.map((t, i) => (i === 3 ? t + 0.18 : t));
    const r = scorePerformance(exp, claps, DEFAULT_SCORING, { bpm: 60 });
    expect(r.counts.late).toBe(1);
    expect(r.hits.find((h) => h.cls === 'late')?.deltaMs).toBeCloseTo(180, 0);
  });

  it('tepukan tertinggal dikesan dengan lokasi bar/detik', () => {
    const claps = perfect.filter((_, i) => i !== 5);
    const r = scorePerformance(exp, claps, DEFAULT_SCORING, { bpm: 60 });
    expect(r.counts.missed).toBe(1);
    expect(r.missed[0]).toMatchObject({ bar: 1, beatInBar: 1 });
    expect(r.pattern).toBeCloseTo(35, 1);
    // masa dinilai atas tepukan dipadankan sahaja → tetap penuh
    expect(r.timing).toBe(40);
  });

  it('tepukan tambahan dikesan', () => {
    const claps = [...perfect, 2.5].sort((a, b) => a - b);
    const r = scorePerformance(exp, claps, DEFAULT_SCORING, { bpm: 60 });
    expect(r.counts.extra).toBe(1);
    expect(r.counts.hits).toBe(8);
    expect(r.pattern).toBeLessThan(40);
  });

  it('tepukan semasa tanda rehat dikesan berasingan', () => {
    const exR = mk('q qr q qr', 60);
    const e = expectedOf(exR);
    const claps = [0, 1.0, 2.0];
    const r = scorePerformance(e, claps, DEFAULT_SCORING, { bpm: 60 });
    expect(r.counts.targets).toBe(2);
    expect(r.counts.restViolations).toBe(1);
    expect(r.counts.extra).toBe(0);
    expect(r.extras[0]?.duringRest).toBe(true);
  });

  it('rehat dipatuhi → markah pola penuh', () => {
    const exR = mk('q qr q qr', 60);
    const r = scorePerformance(expectedOf(exR), [0, 2.0], DEFAULT_SCORING, { bpm: 60 });
    expect(r.pattern).toBe(40);
    expect(r.counts.restViolations).toBe(0);
  });

  it('nilai not pecahan (semikuaver) dipadankan dengan betul pada tempo laju', () => {
    const exS = mk('16 16 16 16 q q q', 110);
    const e = expectedOf(exS);
    const times = clapTimes(exS);
    expect(times.slice(0, 4).map((t) => Math.round(t * 1000))).toEqual([0, 136, 273, 409]);
    const claps = times.map((t, i) => t + (i % 2 ? 0.02 : -0.02));
    const r = scorePerformance(e, claps, DEFAULT_SCORING, { bpm: 110 });
    expect(r.counts.hits).toBe(7);
    expect(r.counts.extra).toBe(0);
    expect(r.counts.onTime).toBe(7);
  });

  it('not bertitik & kuaver: kedudukan sasaran berdasarkan durasi sebenar', () => {
    const exD = mk('q. 8 h', 60);
    expect(clapTimes(exD)).toEqual([0, 1.5, 2]);
  });

  it('not diikat tidak memerlukan tepukan kedua', () => {
    const exT = mk('h~ q q | w', 60);
    expect(clapTimes(exT)).toEqual([0, 3, 4]);
  });

  it('anjakan malar (latensi) tidak menjejaskan kestabilan tempo', () => {
    const claps = perfect.map((t) => t + 0.09);
    const r = scorePerformance(exp, claps, DEFAULT_SCORING, { bpm: 60 });
    expect(r.stability).toBe(20);
    expect(r.counts.onTime).toBe(8);
    expect(r.tempo.meanOffsetMs).toBeCloseTo(90, 0);
  });

  it('hanyut tempo (melaju) dikesan dan mengurangkan kestabilan', () => {
    // murid semakin laju: setiap detik 6% lebih pendek
    const claps = perfect.map((t) => t * 0.94);
    const r = scorePerformance(exp, claps, DEFAULT_SCORING, { bpm: 60 });
    expect(r.tempo.trend).toBe('melaju');
    expect(r.tempo.estimatedBpm).toBeGreaterThan(62);
    expect(r.stability).toBeLessThan(20);
  });

  it('tiada tepukan → 0 markah', () => {
    const r = scorePerformance(exp, [], DEFAULT_SCORING, { bpm: 60 });
    expect(r.total).toBe(0);
    expect(r.counts.missed).toBe(8);
  });

  it('tepukan semasa kiraan masuk diabaikan', () => {
    const r = scorePerformance(exp, [-3, -2, ...perfect], DEFAULT_SCORING, { bpm: 60 });
    expect(r.counts.ignored).toBe(2);
    expect(r.total).toBe(100);
  });

  it('menepuk sedikit not sahaja tidak memberi markah masa penuh (pengawal liputan)', () => {
    const r = scorePerformance(exp, perfect.slice(0, 2), DEFAULT_SCORING, { bpm: 60 });
    expect(r.timing).toBeLessThanOrEqual(20);
    expect(r.total).toBeLessThan(40);
  });

  it('menepuk rambang (dua kali ganda) tidak lulus', () => {
    const spam = perfect.flatMap((t) => [t, t + 0.5]);
    const r = scorePerformance(exp, spam, DEFAULT_SCORING, { bpm: 60 });
    expect(r.counts.extra).toBe(8);
    expect(r.total).toBeLessThan(60);
  });

  it('pemberat boleh dikonfigurasi', () => {
    const s = { ...DEFAULT_SCORING, weights: { pattern: 50, timing: 50, stability: 0 } };
    const r = scorePerformance(exp, perfect, s, { bpm: 60 });
    expect(r.pattern).toBe(50);
    expect(r.total).toBe(100);
  });
});

describe('kategori & bintang', () => {
  it('kategori lalai', () => {
    expect(getCategory(95)).toBe('Cemerlang');
    expect(getCategory(85)).toBe('Sangat Baik');
    expect(getCategory(70)).toBe('Baik');
    expect(getCategory(55)).toBe('Sedang Menguasai');
    expect(getCategory(10)).toBe('Perlu Latihan Tambahan');
  });
  it('bintang', () => {
    expect(computeStars(59, 60)).toBe(0);
    expect(computeStars(65, 60)).toBe(1);
    expect(computeStars(85, 60)).toBe(2);
    expect(computeStars(95, 60)).toBe(3);
  });
});
