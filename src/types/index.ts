// ============================================================
// Jenis data teras RHYTHM MASTER AR
// ============================================================

/** Nilai not asas. Unit durasi = detik krocet (quarter-note beat). */
export type NoteValue = 'w' | 'h' | 'q' | '8' | '16';

/** Satu token ritma dalam bar (not atau tanda rehat). */
export interface RhythmToken {
  value: NoteValue;
  /** Not / rehat bertitik (durasi x1.5). */
  dotted?: boolean;
  /** Tanda rehat (tiada tepukan). */
  rest?: boolean;
  /** Not ini diikat (tie) kepada not seterusnya — not seterusnya TIDAK ditepuk. */
  tie?: boolean;
}

export type BeatsPerBar = 2 | 3 | 4;

export interface Meter {
  beats: BeatsPerBar;
  /** Unit detik (sentiasa 4 = krocet bagi meter 2/4, 3/4, 4/4). */
  beatUnit: 4;
}

export type LevelId = 1 | 2 | 3 | 4;

export interface ScoringWeights {
  pattern: number;
  timing: number;
  stability: number;
}

export interface ScoringSettings {
  /** Toleransi "tepat" (ms). Tepukan dalam ±toleransi dikira tepat pada masanya. */
  toleranceMs: number;
  /** Tetingkap maksimum pemadanan (ms). Di luar ini, tepukan dianggap tambahan. */
  maxWindowMs: number;
  /** Tepukan dalam ±perfectMs mendapat markah masa penuh. */
  perfectMs: number;
  weights: ScoringWeights;
  /** Penalti bagi setiap tepukan tambahan (pecahan daripada satu not sasaran). */
  extraPenalty: number;
  /** Penalti bagi setiap tepukan semasa tanda rehat. */
  restPenalty: number;
}

export interface Exercise {
  id: string;
  title: string;
  level: LevelId;
  meter: Meter;
  tempoBpm: number;
  bars: RhythmToken[][];
  passMark: number;
  description: string;
  /** Fokus pembelajaran ringkas, cth. "Krocet & tanda rehat krocet". */
  focus: string;
  /** Latihan buatan guru (bukan latihan terbina dalam). */
  custom?: boolean;
  /** Tetapan markah khusus untuk latihan ini (jika ada). */
  scoringOverride?: Partial<ScoringSettings>;
  /** Benarkan persembahan tanpa metronom (Tahap 4). */
  allowNoMetronome?: boolean;
  /** Susunan dalam tahap (lebih kecil = lebih awal). */
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type TimelineEventKind = 'clap' | 'rest' | 'hold';

/** Peristiwa ritma pada garis masa (dikira daripada skor). */
export interface TimelineEvent {
  index: number;
  /** Indeks token dalam latihan (merentas bar). */
  tokenIndex: number;
  bar: number; // 0-based
  /** Kedudukan dalam bar (unit detik krocet, 0-based). */
  beatInBar: number;
  /** Kedudukan mutlak dari permulaan muzik (unit detik). */
  startBeat: number;
  durationBeats: number;
  kind: TimelineEventKind;
  /** Masa sasaran (saat) dari permulaan muzik. */
  time: number;
  /** Tempoh (saat). */
  duration: number;
}

export interface ExpectedEvent {
  time: number;
  type: 'clap' | 'rest';
  duration: number;
  index: number;
  bar: number;
  beatInBar: number;
}

export type HitClass = 'perfect' | 'ontime' | 'early' | 'late';

export interface MatchedHit {
  targetIndex: number;
  clapIndex: number;
  targetTime: number;
  clapTime: number;
  /** Ralat masa (ms). Negatif = awal, positif = lewat. */
  deltaMs: number;
  cls: HitClass;
  timingCredit: number; // 0..1
}

export interface ExtraClap {
  clapIndex: number;
  time: number;
  duringRest: boolean;
  restEventIndex?: number;
}

export interface MissedTarget {
  targetIndex: number;
  time: number;
  bar: number;
  beatInBar: number;
}

export interface TempoAnalysis {
  /** Kecerunan masa sebenar vs sasaran. >1 = melambat (dragging), <1 = melaju (rushing). */
  slope: number;
  /** Purata anjakan (ms) — positif bermakna secara purata lewat. */
  meanOffsetMs: number;
  /** Sisihan piawai baki selepas membuang anjakan & hanyut tempo (ms). */
  jitterMs: number;
  /** Anggaran tempo sebenar murid (BPM). */
  estimatedBpm: number;
  trend: 'stabil' | 'melaju' | 'melambat' | 'tidak-cukup-data';
  sufficientData: boolean;
}

export interface ScoreBreakdown {
  total: number;
  pattern: number;
  timing: number;
  stability: number;
  max: ScoringWeights;
  hits: MatchedHit[];
  missed: MissedTarget[];
  extras: ExtraClap[];
  counts: {
    targets: number;
    hits: number;
    perfect: number;
    onTime: number;
    early: number;
    late: number;
    missed: number;
    extra: number;
    restViolations: number;
    ignored: number;
  };
  tempo: TempoAnalysis;
  maxCombo: number;
}

export interface PerformanceCategory {
  min: number;
  label: string;
}

export interface TeacherConfig {
  scoring: ScoringSettings;
  categories: PerformanceCategory[];
  /** Bilangan latihan yang mesti lulus untuk membuka tahap seterusnya. */
  unlockPassCount: number;
  countInBars: 1 | 2;
  /** Benarkan Tahap 4 dimainkan tanpa metronom semasa persembahan. */
  masterNoMetronome: boolean;
}

export type AttemptMode = 'practice' | 'ar' | 'challenge' | 'daily' | 'master';

export interface AttemptRecord {
  id: string;
  profileId: string;
  profileName: string;
  exerciseId: string;
  exerciseTitle: string;
  level: LevelId;
  mode: AttemptMode;
  tempoBpm: number;
  patternScore: number;
  timingScore: number;
  stabilityScore: number;
  totalScore: number;
  stars: number;
  /** Cap masa tepukan (saat relatif kepada permulaan muzik). Tiada audio mentah disimpan. */
  detectedClaps: number[];
  counts: ScoreBreakdown['counts'];
  createdAt: string;
  /** Telah disegerakkan ke Supabase? */
  synced?: boolean;
}

export interface StudentProfile {
  id: string;
  displayName: string;
  avatar: string;
  role: 'student' | 'teacher';
  createdAt: string;
  xp: number;
  /** Tahap tertinggi yang pernah dibuka (tidak dikunci semula). */
  unlockedLevel: LevelId;
  achievements: Record<string, string>; // code -> unlockedAt ISO
  dailyHistory: string[]; // YYYY-MM-DD yang telah selesai cabaran harian
}

export interface UserSettings {
  metronomeVolume: number; // 0..1
  exampleVolume: number;
  reducedMotion: boolean;
  /** Pampasan latensi (ms) — ditolak daripada setiap cap masa tepukan. */
  latencyOffsetMs: number;
  /** Ambang pengesanan tepukan (tenaga jalur tinggi, skala log). null = belum dikalibrasi. */
  clapThreshold: number | null;
  noiseFloor: number | null;
  refractoryMs: number;
  /** Pengganda sensitiviti (0.5 = kurang sensitif, 2 = lebih sensitif). */
  sensitivity: number;
  showHandOverlay: boolean;
  calibratedAt: string | null;
}
