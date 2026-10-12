import type {
  Exercise,
  ExpectedEvent,
  Meter,
  NoteValue,
  RhythmToken,
  TimelineEvent,
} from '@/types';

/** Durasi asas setiap nilai not dalam unit detik krocet. */
export const BASE_BEATS: Record<NoteValue, number> = {
  w: 4,
  h: 2,
  q: 1,
  '8': 0.5,
  '16': 0.25,
};

export const NOTE_NAMES_MS: Record<NoteValue, { note: string; rest: string }> = {
  w: { note: 'Semibrif', rest: 'Rehat semibrif' },
  h: { note: 'Minim', rest: 'Rehat minim' },
  q: { note: 'Krocet', rest: 'Rehat krocet' },
  '8': { note: 'Kuaver', rest: 'Rehat kuaver' },
  '16': { note: 'Semikuaver', rest: 'Rehat semikuaver' },
};

export const TEMPO_MIN = 40;
export const TEMPO_MAX = 180;
const EPS = 1e-9;

export function tokenBeats(t: RhythmToken): number {
  const base = BASE_BEATS[t.value];
  return t.dotted ? base * 1.5 : base;
}

export function barCapacity(meter: Meter): number {
  return meter.beats * (4 / meter.beatUnit);
}

export function tokenLabel(t: RhythmToken): string {
  const n = NOTE_NAMES_MS[t.value];
  return `${t.rest ? n.rest : n.note}${t.dotted ? ' bertitik' : ''}${t.tie ? ' (diikat)' : ''}`;
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

export interface ValidationIssue {
  bar?: number;
  token?: number;
  message: string;
}

/**
 * Validasi teori muzik bagi satu latihan.
 * - Meter mesti 2/4, 3/4 atau 4/4.
 * - Jumlah durasi setiap bar mesti sama dengan meter.
 * - Nilai not mesti sah; titik tidak dibenarkan pada semikuaver (tiada nilai 3/16 dalam sukatan asas).
 * - Ikatan mesti menyambung ke NOT (bukan rehat) dan tidak boleh berada pada token terakhir.
 * - Tempo dalam julat 40–180 BPM.
 * - Mesti ada sekurang-kurangnya satu tepukan.
 */
export function validateExercise(ex: Pick<Exercise, 'meter' | 'tempoBpm' | 'bars' | 'title' | 'passMark'>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (![2, 3, 4].includes(ex.meter.beats) || ex.meter.beatUnit !== 4) {
    issues.push({ message: `Meter ${ex.meter.beats}/${ex.meter.beatUnit} tidak disokong (hanya 2/4, 3/4, 4/4).` });
  }
  if (!Number.isFinite(ex.tempoBpm) || ex.tempoBpm < TEMPO_MIN || ex.tempoBpm > TEMPO_MAX) {
    issues.push({ message: `Tempo mesti antara ${TEMPO_MIN}–${TEMPO_MAX} BPM.` });
  }
  if (!ex.title || !ex.title.trim()) issues.push({ message: 'Tajuk latihan diperlukan.' });
  if (!Number.isFinite(ex.passMark) || ex.passMark < 0 || ex.passMark > 100) {
    issues.push({ message: 'Markah lulus mesti antara 0 dan 100.' });
  }
  if (!Array.isArray(ex.bars) || ex.bars.length === 0) {
    issues.push({ message: 'Latihan mesti mempunyai sekurang-kurangnya satu bar.' });
    return issues;
  }
  if (ex.bars.length > 16) issues.push({ message: 'Maksimum 16 bar bagi satu latihan.' });

  const cap = barCapacity(ex.meter);
  const flat: { t: RhythmToken; bar: number; idx: number }[] = [];
  ex.bars.forEach((bar, b) => {
    if (!Array.isArray(bar) || bar.length === 0) {
      issues.push({ bar: b, message: `Bar ${b + 1} kosong.` });
      return;
    }
    let sum = 0;
    bar.forEach((t, i) => {
      if (!t || !(t.value in BASE_BEATS)) {
        issues.push({ bar: b, token: i, message: `Bar ${b + 1}: nilai not tidak sah.` });
        return;
      }
      if (t.dotted && t.value === '16') {
        issues.push({ bar: b, token: i, message: `Bar ${b + 1}: semikuaver bertitik tidak disokong.` });
      }
      if (t.rest && t.tie) {
        issues.push({ bar: b, token: i, message: `Bar ${b + 1}: tanda rehat tidak boleh diikat.` });
      }
      sum += tokenBeats(t);
      flat.push({ t, bar: b, idx: i });
    });
    if (Math.abs(sum - cap) > EPS) {
      issues.push({
        bar: b,
        message: `Bar ${b + 1}: jumlah durasi ${fmtBeats(sum)} detik, sepatutnya ${fmtBeats(cap)} detik (${ex.meter.beats}/${ex.meter.beatUnit}).`,
      });
    }
  });

  flat.forEach((f, k) => {
    if (f.t.tie) {
      const next = flat[k + 1];
      if (!next) issues.push({ bar: f.bar, token: f.idx, message: `Bar ${f.bar + 1}: ikatan pada not terakhir tidak sah.` });
      else if (next.t.rest) issues.push({ bar: f.bar, token: f.idx, message: `Bar ${f.bar + 1}: ikatan mesti bersambung ke not, bukan rehat.` });
    }
  });

  // Ikatan berantai yang bermula selepas not diikat dikira sebagai "hold"; pastikan ada tepukan.
  const timeline = buildTimelineSafe(ex);
  if (timeline && !timeline.some((e) => e.kind === 'clap')) {
    issues.push({ message: 'Latihan mesti mengandungi sekurang-kurangnya satu not untuk ditepuk.' });
  }
  return issues;
}

function buildTimelineSafe(ex: Pick<Exercise, 'meter' | 'tempoBpm' | 'bars'>): TimelineEvent[] | null {
  try {
    return buildTimeline(ex);
  } catch {
    return null;
  }
}

export function isValidExercise(ex: Exercise): boolean {
  return validateExercise(ex).length === 0;
}

function fmtBeats(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '');
}

/**
 * Bina garis masa peristiwa ritma. Masa dikira secara kumulatif daripada DURASI SEBENAR
 * setiap not (bukan andaian semua not sama panjang):
 *   time = startBeat × (60 / BPM)
 */
export function buildTimeline(ex: Pick<Exercise, 'meter' | 'tempoBpm' | 'bars'>, bpmOverride?: number): TimelineEvent[] {
  const bpm = bpmOverride ?? ex.tempoBpm;
  const spb = secondsPerBeat(bpm);
  const cap = barCapacity(ex.meter);
  const events: TimelineEvent[] = [];
  let tokenIndex = 0;
  let prevTied = false;
  ex.bars.forEach((bar, b) => {
    let beatInBar = 0;
    bar.forEach((t) => {
      const d = tokenBeats(t);
      const startBeat = b * cap + beatInBar;
      const kind = t.rest ? 'rest' : prevTied ? 'hold' : 'clap';
      events.push({
        index: events.length,
        tokenIndex,
        bar: b,
        beatInBar,
        startBeat,
        durationBeats: d,
        kind,
        time: startBeat * spb,
        duration: d * spb,
      });
      prevTied = !t.rest && !!t.tie;
      beatInBar += d;
      tokenIndex++;
    });
  });
  return events;
}

export function totalBeats(ex: Pick<Exercise, 'meter' | 'bars'>): number {
  return ex.bars.length * barCapacity(ex.meter);
}

export function totalDurationSec(ex: Pick<Exercise, 'meter' | 'bars' | 'tempoBpm'>, bpm?: number): number {
  return totalBeats(ex) * secondsPerBeat(bpm ?? ex.tempoBpm);
}

/** Senarai peristiwa sasaran untuk enjin penilaian (tepukan & rehat). Not diikat (hold) dikecualikan. */
export function toExpectedEvents(timeline: TimelineEvent[]): ExpectedEvent[] {
  return timeline
    .filter((e) => e.kind !== 'hold')
    .map((e) => ({
      time: e.time,
      type: e.kind === 'rest' ? 'rest' : 'clap',
      duration: e.duration,
      index: e.index,
      bar: e.bar,
      beatInBar: e.beatInBar,
    }));
}

/** Gabungkan tempoh not yang diikat ke dalam tempoh tepukan sebelumnya (untuk audio contoh). */
export function clapEventsWithSustain(timeline: TimelineEvent[]): { time: number; duration: number }[] {
  const out: { time: number; duration: number }[] = [];
  for (const e of timeline) {
    if (e.kind === 'clap') out.push({ time: e.time, duration: e.duration });
    else if (e.kind === 'hold' && out.length) out[out.length - 1]!.duration += e.duration;
  }
  return out;
}

export function beatLabel(beatInBar: number): string {
  // Kiraan murid: 1, 1-dan, 1-e-dan-a ...
  const whole = Math.floor(beatInBar + EPS);
  const frac = beatInBar - whole;
  const n = whole + 1;
  if (Math.abs(frac) < EPS) return `detik ${n}`;
  if (Math.abs(frac - 0.5) < EPS) return `detik ${n}-dan`;
  if (Math.abs(frac - 0.25) < EPS) return `detik ${n}-e`;
  if (Math.abs(frac - 0.75) < EPS) return `detik ${n}-a`;
  return `detik ${(beatInBar + 1).toFixed(2)}`;
}

export function meterLabel(m: Meter): string {
  return `${m.beats}/${m.beatUnit}`;
}

/** Notasi ringkas teks (untuk borang guru / import): q q h | 8 8 q qr q  — "r" rehat, "." titik, "~" ikat. */
export function parseRhythmText(text: string): RhythmToken[][] {
  const bars = text
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return bars.map((bar, b) =>
    bar
      .split(/\s+/)
      .filter(Boolean)
      .map((raw) => {
        const m = /^(w|h|q|8|16)(r?)(\.?)(~?)$/.exec(raw);
        if (!m) throw new Error(`Bar ${b + 1}: token "${raw}" tidak difahami.`);
        const tok: RhythmToken = { value: m[1] as NoteValue };
        if (m[2]) tok.rest = true;
        if (m[3]) tok.dotted = true;
        if (m[4]) tok.tie = true;
        return tok;
      }),
  );
}

export function rhythmToText(bars: RhythmToken[][]): string {
  return bars
    .map((bar) => bar.map((t) => `${t.value}${t.rest ? 'r' : ''}${t.dotted ? '.' : ''}${t.tie ? '~' : ''}`).join(' '))
    .join(' | ');
}
