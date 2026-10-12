import type { Exercise, LevelId, Meter } from '@/types';
import { parseRhythmText, validateExercise } from '@/lib/rhythm';

// ------------------------------------------------------------
// Notasi ringkas:  w h q 8 16  | "r" = rehat | "." = bertitik | "~" = diikat ke not seterusnya
// Setiap latihan DISAHKAN oleh validateExercise() (juga dalam ujian unit).
// ------------------------------------------------------------

const M2: Meter = { beats: 2, beatUnit: 4 };
const M3: Meter = { beats: 3, beatUnit: 4 };
const M4: Meter = { beats: 4, beatUnit: 4 };

interface Def {
  id: string;
  title: string;
  level: LevelId;
  meter: Meter;
  bpm: number;
  rhythm: string;
  focus: string;
  description: string;
  allowNoMetronome?: boolean;
}

const PASS: Record<LevelId, number> = { 1: 60, 2: 65, 3: 70, 4: 75 };

const DEFS: Def[] = [
  // ---------------- TAHAP 1 — ROOKIE RHYTHM (60–75 BPM) ----------------
  { id: 'l1-01', title: 'Langkah Krocet', level: 1, meter: M4, bpm: 60, rhythm: 'q q q q | q q q q',
    focus: 'Krocet (1 detik)', description: 'Tepuk satu kali pada setiap detik. Krocet bernilai satu detik.' },
  { id: 'l1-02', title: 'Minim Bertemu Krocet', level: 1, meter: M4, bpm: 64, rhythm: 'h q q | q q h',
    focus: 'Minim (2 detik) & krocet', description: 'Minim ditepuk sekali dan ditahan selama dua detik — jangan tepuk pada detik kedua.' },
  { id: 'l1-03', title: 'Kuaver Berpasangan', level: 1, meter: M4, bpm: 66, rhythm: 'q q 8 8 q | 8 8 8 8 h',
    focus: 'Kuaver (½ detik)', description: 'Dua kuaver mengisi satu detik. Sebut "ta-ti" sambil menepuk.' },
  { id: 'l1-04', title: 'Rehat Krocet', level: 1, meter: M4, bpm: 68, rhythm: 'q qr q qr | q q q qr',
    focus: 'Tanda rehat krocet', description: 'Pada tanda rehat, diam dan rasakan detik tanpa menepuk.' },
  { id: 'l1-05', title: 'Semibrif Panjang', level: 1, meter: M4, bpm: 60, rhythm: 'q q h | w',
    focus: 'Semibrif (4 detik)', description: 'Semibrif ditepuk sekali dan ditahan selama empat detik penuh.' },
  { id: 'l1-06', title: 'Rookie Mix', level: 1, meter: M4, bpm: 72, rhythm: 'q 8 8 q qr | h 8 8 q',
    focus: 'Gabungan asas', description: 'Gabungkan krocet, kuaver, minim dan rehat krocet.' },

  // ---------------- TAHAP 2 — BEAT EXPLORER (70–90 BPM) ----------------
  { id: 'l2-01', title: 'Waltz Pertama', level: 2, meter: M3, bpm: 76, rhythm: 'q q q | h q | q 8 8 q | h.',
    focus: 'Meter 3/4 & minim bertitik', description: 'Tiga detik sebar. Minim bertitik mengisi satu bar 3/4 penuh.' },
  { id: 'l2-02', title: 'Mars 2/4', level: 2, meter: M2, bpm: 80, rhythm: 'q q | 8 8 q | q 8 8 | h',
    focus: 'Meter 2/4', description: 'Dua detik sebar seperti langkah kawad: KIRI-kanan.' },
  { id: 'l2-03', title: 'Rehat Minim', level: 2, meter: M4, bpm: 78, rhythm: 'q q hr | 8 8 q q qr | hr q q | w',
    focus: 'Rehat minim (2 detik)', description: 'Rehat minim = senyap dua detik. Kira dalam hati.' },
  { id: 'l2-04', title: 'Penjelajah 3/4', level: 2, meter: M3, bpm: 84, rhythm: 'q 8 8 q | q qr q | 8 8 8 8 q | h qr',
    focus: 'Gabungan dalam 3/4', description: 'Pola empat bar dalam meter 3/4 dengan kuaver dan rehat.' },
  { id: 'l2-05', title: 'Empat Bar Penuh', level: 2, meter: M4, bpm: 86, rhythm: 'q q 8 8 q | h h | 8 8 8 8 q qr | q q h',
    focus: 'Pola empat bar', description: 'Kekalkan tempo yang sama sepanjang empat bar.' },
  { id: 'l2-06', title: 'Rehat Kuaver', level: 2, meter: M2, bpm: 90, rhythm: '8 8r q | 8r 8 q | 8 8 8 8 | q qr',
    focus: 'Rehat kuaver (½ detik)', description: 'Rehat kuaver hanya setengah detik — tepukan selepasnya jatuh pada "dan".' },

  // ---------------- TAHAP 3 — RHYTHM EXPERT (≤110 BPM) ----------------
  { id: 'l3-01', title: 'Krocet Bertitik', level: 3, meter: M4, bpm: 90, rhythm: 'q. 8 q q | q. 8 h',
    focus: 'Krocet bertitik (1½ detik)', description: 'Krocet bertitik = 1½ detik; kuaver selepasnya jatuh pada "dan" detik kedua.' },
  { id: 'l3-02', title: 'Semikuaver Bergerak', level: 3, meter: M4, bpm: 92, rhythm: '16 16 16 16 q q q | 8 16 16 q h',
    focus: 'Semikuaver (¼ detik)', description: 'Empat semikuaver mengisi satu detik: "ta-ka-di-mi".' },
  { id: 'l3-03', title: 'Minim Bertitik 3/4', level: 3, meter: M3, bpm: 96, rhythm: 'h. | q 8 8 q | h q | h.',
    focus: 'Minim bertitik', description: 'Rasakan tiga detik penuh bagi minim bertitik.' },
  { id: 'l3-04', title: 'Sinkopasi Asas', level: 3, meter: M2, bpm: 100, rhythm: '8 q 8 | q q | 8 q 8 | h',
    focus: 'Sinkopasi (ti-ta-ti)', description: 'Krocet di tengah jatuh di antara detik — tekanan beralih dari detik kuat.' },
  { id: 'l3-05', title: 'Ikatan Merentas Detik', level: 3, meter: M4, bpm: 96, rhythm: 'q 8 8~ 8 8 q | q q q q~ | q q h',
    focus: 'Ikatan not (tie)', description: 'Not yang diikat ditepuk SEKALI sahaja dan ditahan merentas detik/bar.' },
  { id: 'l3-06', title: 'Gallop & Kuaver Bertitik', level: 3, meter: M4, bpm: 104, rhythm: '8 16 16 8 16 16 q q | 8. 16 8. 16 h',
    focus: 'Pembahagian detik', description: 'Corak "gallop" dan kuaver bertitik + semikuaver.' },

  // ---------------- TAHAP 4 — RHYTHM MASTER ----------------
  { id: 'l4-01', title: 'Campuran Master I', level: 4, meter: M4, bpm: 100, rhythm: 'q. 8 8 8 q | 16 16 8 qr h | 8 q 8 q q | w',
    focus: 'Pola campuran', description: 'Gabungan semua nilai not dalam empat bar.', allowNoMetronome: true },
  { id: 'l4-02', title: 'Waltz Master', level: 4, meter: M3, bpm: 108, rhythm: 'q. 8 q | 8 8 8r 8 q | 16 16 8 q q | h.',
    focus: '3/4 lanjutan', description: 'Waltz dengan krocet bertitik, rehat kuaver dan semikuaver.', allowNoMetronome: true },
  { id: 'l4-03', title: 'Sinkopasi Lanjutan', level: 4, meter: M4, bpm: 104, rhythm: '8 q 8 q q | 8 q 8~ 8 8 q | q 8 8 8 q 8 | h hr',
    focus: 'Sinkopasi & ikatan', description: 'Tekanan luar detik yang berterusan — kekalkan nadi dalaman.', allowNoMetronome: true },
  { id: 'l4-04', title: 'Mars Master 2/4', level: 4, meter: M2, bpm: 112, rhythm: '16 16 16 16 8 8 | 8. 16 q | 8 16 16 8r 8 | q qr | 8 8 q | 16 16 8 q | q. 8 | h',
    focus: 'Lapan bar 2/4', description: 'Latihan lapan bar — ketahanan dan kestabilan tempo.', allowNoMetronome: true },
  { id: 'l4-05', title: 'Rehat Senyap', level: 4, meter: M4, bpm: 100, rhythm: 'qr q qr q | 8r 8 8r 8 q qr | q q hr | qr 8 8 h',
    focus: 'Tepukan luar detik selepas rehat', description: 'Banyak tanda rehat — tepukan bermula di luar detik kuat.', allowNoMetronome: true },
  { id: 'l4-06', title: 'Kemuncak Rhythm Master', level: 4, meter: M4, bpm: 110, rhythm: 'q 8 8 q. 8 | 16 16 16 16 8 8 h | 8 q 8 q~ 8 8 | q qr 8 8 q | q. 8 h | w',
    focus: 'Cabaran akhir', description: 'Enam bar menggabungkan semua konsep. Untuk Rhythm Master sejati!', allowNoMetronome: true },
];

function build(d: Def): Exercise {
  return {
    id: d.id,
    title: d.title,
    level: d.level,
    meter: d.meter,
    tempoBpm: d.bpm,
    bars: parseRhythmText(d.rhythm),
    passMark: PASS[d.level],
    description: d.description,
    focus: d.focus,
    allowNoMetronome: d.allowNoMetronome,
  };
}

export const BUILTIN_EXERCISES: Exercise[] = DEFS.map(build);

// Validasi semasa modul dimuatkan — latihan tidak sah TIDAK akan digunakan.
const invalid = BUILTIN_EXERCISES.filter((e) => validateExercise(e).length > 0);
if (invalid.length > 0) {
  console.error('[RhythmMaster] Latihan terbina dalam tidak sah:', invalid.map((e) => [e.id, validateExercise(e)]));
}
export const VALID_BUILTIN_EXERCISES: Exercise[] = BUILTIN_EXERCISES.filter((e) => validateExercise(e).length === 0);

export const LEVELS: { id: LevelId; name: string; subtitle: string; tempo: string; color: string; topics: string[] }[] = [
  { id: 1, name: 'ROOKIE RHYTHM', subtitle: 'Nilai not asas', tempo: '60–75 BPM', color: 'cyan', topics: ['Krocet', 'Minim', 'Kuaver', 'Semibrif', 'Rehat krocet'] },
  { id: 2, name: 'BEAT EXPLORER', subtitle: 'Gabungan & meter', tempo: '70–90 BPM', color: 'teal', topics: ['2/4, 3/4, 4/4', 'Pola 4 bar', 'Rehat minim & kuaver'] },
  { id: 3, name: 'RHYTHM EXPERT', subtitle: 'Not bertitik & pembahagian', tempo: '90–110 BPM', color: 'violet', topics: ['Not bertitik', 'Semikuaver', 'Sinkopasi', 'Ikatan'] },
  { id: 4, name: 'RHYTHM MASTER', subtitle: 'Pola campuran lanjutan', tempo: '100–112 BPM', color: 'gold', topics: ['Pola campuran', 'Banyak bar', 'Tanpa metronom (pilihan guru)'] },
];
