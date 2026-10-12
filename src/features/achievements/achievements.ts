import type { AttemptMode, AttemptRecord, Exercise, LevelId, ScoreBreakdown, StudentProfile } from '@/types';

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: 'star' | 'trophy' | 'flame' | 'target' | 'metronome' | 'camera' | 'medal' | 'crown' | 'zap' | 'calendar';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'FIRST_CLAP', title: 'Tepukan Pertama', description: 'Selesaikan latihan pertama anda.', icon: 'star' },
  { code: 'PASS_5', title: 'Pelajar Gigih', description: 'Lulus 5 latihan berbeza.', icon: 'medal' },
  { code: 'THREE_STARS', title: 'Tiga Bintang', description: 'Dapatkan 3 bintang dalam satu latihan.', icon: 'star' },
  { code: 'PERFECT_TIMING', title: 'Masa Sempurna', description: 'Markah ketepatan masa sekurang-kurangnya 95% daripada maksimum.', icon: 'target' },
  { code: 'STEADY_TEMPO', title: 'Tempo Kukuh', description: 'Markah kestabilan tempo penuh dalam latihan ≥ 8 tepukan.', icon: 'metronome' },
  { code: 'COMBO_10', title: 'Kombo 10', description: '10 tepukan tepat berturut-turut.', icon: 'zap' },
  { code: 'REST_MASTER', title: 'Raja Senyap', description: 'Lulus latihan yang mengandungi tanda rehat tanpa menepuk semasa rehat.', icon: 'target' },
  { code: 'LEVEL_2', title: 'Beat Explorer', description: 'Buka Tahap 2.', icon: 'trophy' },
  { code: 'LEVEL_3', title: 'Rhythm Expert', description: 'Buka Tahap 3.', icon: 'trophy' },
  { code: 'LEVEL_4', title: 'Rhythm Master', description: 'Buka Tahap 4.', icon: 'crown' },
  { code: 'AR_EXPLORER', title: 'Penjelajah AR', description: 'Selesaikan latihan dalam Rhythm AR Arena.', icon: 'camera' },
  { code: 'DAILY_3', title: 'Streak 3 Hari', description: 'Selesaikan Daily Rhythm Challenge 3 hari berturut-turut.', icon: 'calendar' },
  { code: 'CHALLENGE_WIN', title: 'Juara Cabaran', description: 'Purata ≥ 80 dalam Rhythm Challenge.', icon: 'flame' },
  { code: 'NO_METRONOME', title: 'Nadi Dalaman', description: 'Lulus latihan Tahap 4 tanpa metronom.', icon: 'crown' },
];

export function achievementDef(code: string) {
  return ACHIEVEMENTS.find((a) => a.code === code);
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dailyStreak(history: string[], today = new Date()): number {
  const set = new Set(history);
  let n = 0;
  const d = new Date(today);
  // streak dikira dari hari ini (atau semalam jika hari ini belum dibuat)
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(todayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Tahap tertinggi yang dibuka berdasarkan rekod lulus. Tahap tidak dikunci semula. */
export function computeUnlockedLevel(
  attempts: AttemptRecord[],
  exercises: Exercise[],
  unlockPassCount: number,
  current: LevelId,
): LevelId {
  const passed = new Set<string>();
  for (const a of attempts) {
    const ex = exercises.find((e) => e.id === a.exerciseId);
    const pm = ex?.passMark ?? 60;
    if (a.totalScore >= pm) passed.add(a.exerciseId);
  }
  let lvl: LevelId = 1;
  for (const L of [1, 2, 3] as LevelId[]) {
    const inLevel = exercises.filter((e) => e.level === L);
    const need = Math.min(unlockPassCount, inLevel.length);
    const got = inLevel.filter((e) => passed.has(e.id)).length;
    if (inLevel.length > 0 && got >= need) lvl = (L + 1) as LevelId;
    else break;
  }
  return Math.max(lvl, current) as LevelId;
}

export interface EvalContext {
  profile: StudentProfile;
  attempts: AttemptRecord[]; // termasuk percubaan baharu
  exercise: Exercise;
  result: ScoreBreakdown;
  mode: AttemptMode;
  noMetronome: boolean;
  newUnlockedLevel: LevelId;
}

export function evaluateAchievements(c: EvalContext): string[] {
  const have = new Set(Object.keys(c.profile.achievements));
  const out: string[] = [];
  const add = (code: string, cond: boolean) => {
    if (cond && !have.has(code)) out.push(code);
  };
  const r = c.result;
  const passed = r.total >= c.exercise.passMark;
  const mine = c.attempts.filter((a) => a.profileId === c.profile.id);
  const passedIds = new Set(mine.filter((a) => a.stars > 0).map((a) => a.exerciseId));
  add('FIRST_CLAP', mine.length >= 1);
  add('PASS_5', passedIds.size >= 5);
  add('THREE_STARS', r.total >= 92 && passed);
  add('PERFECT_TIMING', r.max.timing > 0 && r.timing >= r.max.timing * 0.95);
  add('STEADY_TEMPO', r.counts.targets >= 8 && r.max.stability > 0 && r.stability >= r.max.stability);
  add('COMBO_10', r.maxCombo >= 10);
  const hasRest = c.exercise.bars.some((b) => b.some((t) => t.rest));
  add('REST_MASTER', hasRest && passed && r.counts.restViolations === 0);
  add('LEVEL_2', c.newUnlockedLevel >= 2);
  add('LEVEL_3', c.newUnlockedLevel >= 3);
  add('LEVEL_4', c.newUnlockedLevel >= 4);
  add('AR_EXPLORER', c.mode === 'ar');
  add('NO_METRONOME', c.noMetronome && passed && c.exercise.level === 4);
  return out;
}

export function xpFor(result: ScoreBreakdown, stars: number): number {
  return Math.round(result.total + stars * 20 + result.maxCombo * 2);
}

export function playerRank(xp: number): { title: string; next: number; prev: number } {
  const ranks = [
    { at: 0, title: 'Pemula Irama' },
    { at: 300, title: 'Penepuk Muda' },
    { at: 900, title: 'Penjaga Tempo' },
    { at: 2000, title: 'Pakar Detik' },
    { at: 4000, title: 'Rhythm Master' },
  ];
  let i = 0;
  while (i < ranks.length - 1 && xp >= ranks[i + 1]!.at) i++;
  return { title: ranks[i]!.title, prev: ranks[i]!.at, next: ranks[i + 1]?.at ?? ranks[i]!.at };
}

/** Pilihan latihan harian berdasarkan tarikh (sama untuk semua murid pada hari yang sama). */
export function dailyExercise(exercises: Exercise[], unlocked: LevelId, date = new Date()): Exercise | undefined {
  const pool = exercises.filter((e) => e.level <= unlocked);
  if (!pool.length) return undefined;
  const key = todayKey(date);
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return pool[Math.abs(h) % pool.length];
}
