import { describe, expect, it } from 'vitest';
import { attemptsToCsv } from './csv';
import type { AttemptRecord } from '@/types';

describe('eksport CSV', () => {
  it('menghasilkan pengepala dan melarikan aksara khas', () => {
    const a: AttemptRecord = {
      id: '1',
      profileId: 'p',
      profileName: 'Ali, "Kecil"',
      exerciseId: 'l1-01',
      exerciseTitle: 'Langkah Krocet',
      level: 1,
      mode: 'practice',
      tempoBpm: 60,
      patternScore: 40,
      timingScore: 38.5,
      stabilityScore: 20,
      totalScore: 99,
      stars: 3,
      detectedClaps: [0, 1],
      counts: { targets: 8, hits: 8, perfect: 7, onTime: 8, early: 0, late: 0, missed: 0, extra: 0, restViolations: 0, ignored: 0 },
      createdAt: '2026-10-12T00:00:00.000Z',
    };
    const csv = attemptsToCsv([a]);
    const [h, row] = csv.split('\r\n');
    expect(h!.startsWith('tarikh,murid,latihan_id')).toBe(true);
    expect(row).toContain('"Ali, ""Kecil"""');
    expect(row).toContain(',99,3,');
  });
});
