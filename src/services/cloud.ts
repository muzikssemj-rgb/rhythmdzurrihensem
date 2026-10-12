import type { AttemptRecord, Exercise, LevelId, RhythmToken } from '@/types';
import { getSupabase } from './supabaseClient';

// ============================================================
// Operasi Supabase. Semua fungsi mengembalikan ralat yang mesra pengguna.
// Keselamatan sebenar dikuatkuasakan oleh RLS + RPC di pelayan (lihat supabase/migrations).
// ============================================================

export interface CloudUser {
  id: string;
  email: string | null;
  displayName: string;
  role: 'student' | 'teacher';
  avatar: string;
}

async function sb() {
  const c = await getSupabase();
  if (!c) throw new Error('Backend tidak dikonfigurasikan.');
  return c;
}

export async function cloudSession(): Promise<CloudUser | null> {
  const c = await getSupabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const { data: p } = await c.from('profiles').select('display_name, role, avatar').eq('id', u.id).maybeSingle();
  return {
    id: u.id,
    email: u.email ?? null,
    displayName: (p?.display_name as string) ?? 'Murid',
    role: (p?.role as 'student' | 'teacher') ?? 'student',
    avatar: (p?.avatar as string) ?? 'drum',
  };
}

export async function cloudSignIn(email: string, password: string): Promise<CloudUser> {
  const c = await sb();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mel atau kata laluan salah.' : error.message);
  const u = await cloudSession();
  if (!u) throw new Error('Log masuk gagal.');
  return u;
}

export async function cloudSignUp(email: string, password: string, displayName: string): Promise<string> {
  const c = await sb();
  const { error, data } = await c.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw new Error(error.message);
  return data.session ? 'Akaun dicipta dan anda telah log masuk.' : 'Akaun dicipta. Semak e-mel untuk pengesahan sebelum log masuk.';
}

export async function cloudSignOut() {
  const c = await getSupabase();
  await c?.auth.signOut();
}

export async function cloudUpdateProfile(id: string, displayName: string, avatar: string) {
  const c = await sb();
  const { error } = await c.from('profiles').update({ display_name: displayName, avatar }).eq('id', id);
  if (error) throw new Error(error.message);
}

interface ExerciseRow {
  id: string;
  title: string;
  level: number;
  meter: string;
  tempo_bpm: number;
  rhythm_data: RhythmToken[][];
  scoring_settings: Exercise['scoringOverride'] | null;
  pass_mark: number;
  description: string;
  focus: string;
  allow_no_metronome: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToExercise(r: ExerciseRow): Exercise {
  const beats = Number(r.meter.split('/')[0]) as 2 | 3 | 4;
  return {
    id: r.id,
    title: r.title,
    level: r.level as LevelId,
    meter: { beats, beatUnit: 4 },
    tempoBpm: r.tempo_bpm,
    bars: r.rhythm_data,
    scoringOverride: r.scoring_settings ?? undefined,
    passMark: r.pass_mark,
    description: r.description,
    focus: r.focus,
    allowNoMetronome: r.allow_no_metronome,
    order: r.sort_order,
    custom: true,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function cloudFetchExercises(): Promise<Exercise[]> {
  const c = await sb();
  const { data, error } = await c.from('rhythm_exercises').select('*').eq('is_active', true).order('level').order('sort_order');
  if (error) throw new Error(error.message);
  return (data as ExerciseRow[]).map(rowToExercise);
}

export async function cloudUpsertExercise(ex: Exercise) {
  const c = await sb();
  const { error } = await c.from('rhythm_exercises').upsert({
    id: ex.id,
    title: ex.title,
    level: ex.level,
    meter: `${ex.meter.beats}/${ex.meter.beatUnit}`,
    tempo_bpm: ex.tempoBpm,
    rhythm_data: ex.bars,
    scoring_settings: ex.scoringOverride ?? null,
    pass_mark: ex.passMark,
    description: ex.description,
    focus: ex.focus,
    allow_no_metronome: !!ex.allowNoMetronome,
    sort_order: ex.order ?? 100,
    is_active: true,
  });
  if (error) throw new Error(error.message.includes('rhythm_valid') ? 'Pelayan menolak pola: jumlah durasi bar tidak sepadan dengan meter.' : error.message);
}

export async function cloudDeleteExercise(id: string) {
  const c = await sb();
  const { error } = await c.from('rhythm_exercises').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function cloudSubmitAttempt(a: AttemptRecord): Promise<void> {
  const c = await sb();
  const { error } = await c.rpc('submit_attempt', {
    p_exercise_id: a.exerciseId,
    p_exercise_title: a.exerciseTitle,
    p_level: a.level,
    p_mode: a.mode,
    p_tempo: a.tempoBpm,
    p_pattern: a.patternScore,
    p_timing: a.timingScore,
    p_stability: a.stabilityScore,
    p_total: a.totalScore,
    p_stars: a.stars,
    p_claps: a.detectedClaps.map((t) => Math.round(t * 1000) / 1000),
    p_counts: a.counts,
  });
  if (error) throw new Error(error.message);
}

export async function cloudUnlockAchievement(userId: string, code: string) {
  const c = await sb();
  await c.from('achievements').upsert({ user_id: userId, achievement_code: code }, { onConflict: 'user_id,achievement_code', ignoreDuplicates: true });
}

interface AttemptRow {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_title: string;
  level: number;
  mode: AttemptRecord['mode'];
  tempo_bpm: number;
  pattern_score: number;
  timing_score: number;
  stability_score: number;
  total_score: number;
  stars: number;
  detected_claps: number[];
  counts: AttemptRecord['counts'];
  created_at: string;
  profiles?: { display_name: string } | null;
}

/** Guru: rekod murid dalam kelasnya (RLS). Murid: rekod sendiri. */
export async function cloudFetchAttempts(limit = 500): Promise<AttemptRecord[]> {
  const c = await sb();
  const { data, error } = await c
    .from('practice_attempts')
    .select('*, profiles(display_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AttemptRow[]).map((r) => ({
    id: r.id,
    profileId: r.user_id,
    profileName: r.profiles?.display_name ?? '—',
    exerciseId: r.exercise_id,
    exerciseTitle: r.exercise_title,
    level: r.level as LevelId,
    mode: r.mode,
    tempoBpm: r.tempo_bpm,
    patternScore: Number(r.pattern_score),
    timingScore: Number(r.timing_score),
    stabilityScore: Number(r.stability_score),
    totalScore: r.total_score,
    stars: r.stars,
    detectedClaps: r.detected_claps,
    counts: r.counts,
    createdAt: r.created_at,
    synced: true,
  }));
}

export interface ClassInfo {
  id: string;
  name: string;
  joinCode: string;
}

export async function cloudFetchClasses(): Promise<ClassInfo[]> {
  const c = await sb();
  const { data, error } = await c.from('classes').select('id, name, join_code').order('created_at');
  if (error) throw new Error(error.message);
  return (data as { id: string; name: string; join_code: string }[]).map((r) => ({ id: r.id, name: r.name, joinCode: r.join_code }));
}

export async function cloudCreateClass(teacherId: string, name: string) {
  const c = await sb();
  const { error } = await c.from('classes').insert({ teacher_id: teacherId, name });
  if (error) throw new Error(error.message);
}

export async function cloudJoinClass(code: string) {
  const c = await sb();
  const { error } = await c.rpc('join_class', { p_code: code });
  if (error) throw new Error(error.message);
}
