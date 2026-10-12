import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, VALID_BUILTIN_EXERCISES } from '@/data/exercises';
import { barCapacity, buildTimeline, parseRhythmText, rhythmToText, tokenBeats, validateExercise } from './rhythm';
import type { Exercise } from '@/types';

describe('latihan terbina dalam', () => {
  it('mempunyai sekurang-kurangnya 20 latihan, semuanya sah', () => {
    expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(20);
    for (const ex of BUILTIN_EXERCISES) {
      expect(validateExercise(ex), `${ex.id} ${ex.title}`).toEqual([]);
    }
    expect(VALID_BUILTIN_EXERCISES.length).toBe(BUILTIN_EXERCISES.length);
  });

  it('setiap tahap mempunyai sekurang-kurangnya 5 latihan', () => {
    for (const lvl of [1, 2, 3, 4]) {
      expect(BUILTIN_EXERCISES.filter((e) => e.level === lvl).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('jumlah durasi setiap bar = meter', () => {
    for (const ex of BUILTIN_EXERCISES) {
      for (const bar of ex.bars) {
        expect(bar.reduce((a, t) => a + tokenBeats(t), 0)).toBeCloseTo(barCapacity(ex.meter), 9);
      }
    }
  });

  it('julat tempo mengikut tahap', () => {
    for (const ex of BUILTIN_EXERCISES) {
      if (ex.level === 1) expect(ex.tempoBpm).toBeGreaterThanOrEqual(60), expect(ex.tempoBpm).toBeLessThanOrEqual(75);
      if (ex.level === 2) expect(ex.tempoBpm).toBeGreaterThanOrEqual(70), expect(ex.tempoBpm).toBeLessThanOrEqual(90);
      if (ex.level === 3) expect(ex.tempoBpm).toBeLessThanOrEqual(110);
    }
  });

  it('ID unik', () => {
    expect(new Set(BUILTIN_EXERCISES.map((e) => e.id)).size).toBe(BUILTIN_EXERCISES.length);
  });
});

const base = (rhythm: string, beats: 2 | 3 | 4 = 4): Exercise => ({
  id: 'x', title: 'X', level: 1, meter: { beats, beatUnit: 4 }, tempoBpm: 80, bars: parseRhythmText(rhythm), passMark: 60, description: '', focus: '',
});

describe('validasi teori muzik', () => {
  it('menolak bar yang tidak cukup / berlebihan', () => {
    expect(validateExercise(base('q q q'))).not.toEqual([]);
    expect(validateExercise(base('h h q'))).not.toEqual([]);
    expect(validateExercise(base('q q q', 3))).toEqual([]);
  });
  it('menolak ikatan ke tanda rehat & ikatan pada not terakhir', () => {
    expect(validateExercise(base('h~ hr'))).not.toEqual([]);
    expect(validateExercise(base('h h~'))).not.toEqual([]);
  });
  it('menolak tempo di luar julat', () => {
    expect(validateExercise({ ...base('w'), tempoBpm: 30 })).not.toEqual([]);
    expect(validateExercise({ ...base('w'), tempoBpm: 200 })).not.toEqual([]);
  });
  it('menolak latihan tanpa tepukan', () => {
    expect(validateExercise(base('wr'))).not.toEqual([]);
  });
  it('menolak token tidak dikenali', () => {
    expect(() => parseRhythmText('q q x q')).toThrow();
  });
  it('round-trip teks ↔ data', () => {
    const t = 'q. 8 q~ q | 16 16 8 qr h';
    expect(rhythmToText(parseRhythmText(t))).toBe(t);
  });
});

describe('garis masa', () => {
  it('masa dikira daripada durasi sebenar & tempo', () => {
    const tl = buildTimeline(base('h q 8 8'), 120);
    expect(tl.map((e) => e.time)).toEqual([0, 1, 1.5, 1.75]);
    expect(tl.map((e) => e.duration)).toEqual([1, 0.5, 0.25, 0.25]);
  });
  it('bar kedua bermula selepas kapasiti bar pertama (3/4)', () => {
    const tl = buildTimeline(base('h. | q q q', 3), 60);
    expect(tl[1]!.time).toBe(3);
    expect(tl[1]!.bar).toBe(1);
  });
});
