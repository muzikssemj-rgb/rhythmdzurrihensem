import type { AttemptRecord } from '@/types';

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function attemptsToCsv(rows: AttemptRecord[]): string {
  const header = [
    'tarikh',
    'murid',
    'latihan_id',
    'latihan',
    'tahap',
    'mod',
    'tempo_bpm',
    'ketepatan_pola',
    'ketepatan_masa',
    'kestabilan_tempo',
    'jumlah',
    'bintang',
    'tepat',
    'awal',
    'lewat',
    'tertinggal',
    'tambahan',
    'semasa_rehat',
    'bil_sasaran',
  ];
  const lines = rows.map((a) =>
    [
      a.createdAt,
      a.profileName,
      a.exerciseId,
      a.exerciseTitle,
      a.level,
      a.mode,
      a.tempoBpm,
      a.patternScore,
      a.timingScore,
      a.stabilityScore,
      a.totalScore,
      a.stars,
      a.counts?.onTime ?? '',
      a.counts?.early ?? '',
      a.counts?.late ?? '',
      a.counts?.missed ?? '',
      a.counts?.extra ?? '',
      a.counts?.restViolations ?? '',
      a.counts?.targets ?? '',
    ]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...lines].join('\r\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  // BOM supaya Excel membaca UTF-8 dengan betul
  const blob = new Blob(['﻿' + text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
