import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AttemptMode,
  AttemptRecord,
  Exercise,
  LevelId,
  ScoreBreakdown,
  StudentProfile,
  TeacherConfig,
  UserSettings,
} from '@/types';
import { VALID_BUILTIN_EXERCISES } from '@/data/exercises';
import { validateExercise } from '@/lib/rhythm';
import { DEFAULT_CATEGORIES, DEFAULT_SCORING, computeStars } from '@/features/scoring/scoringEngine';
import {
  computeUnlockedLevel,
  dailyStreak,
  evaluateAchievements,
  todayKey,
  xpFor,
} from '@/features/achievements/achievements';
import { loadJSON, saveJSON, storageAvailable, uid } from '@/services/localStore';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import * as cloud from '@/services/cloud';

export const DEFAULT_SETTINGS: UserSettings = {
  metronomeVolume: 0.7,
  exampleVolume: 0.9,
  reducedMotion: false,
  latencyOffsetMs: 0,
  clapThreshold: null,
  noiseFloor: null,
  refractoryMs: 70,
  sensitivity: 1,
  showHandOverlay: true,
  calibratedAt: null,
};

export const DEFAULT_CONFIG: TeacherConfig = {
  scoring: DEFAULT_SCORING,
  categories: DEFAULT_CATEGORIES,
  unlockPassCount: 3,
  countInBars: 1,
  masterNoMetronome: true,
};

function newProfile(name: string, avatar: string, role: 'student' | 'teacher' = 'student', id?: string): StudentProfile {
  return {
    id: id ?? uid('p-'),
    displayName: name,
    avatar,
    role,
    createdAt: new Date().toISOString(),
    xp: 0,
    unlockedLevel: 1,
    achievements: {},
    dailyHistory: [],
  };
}

export interface RecordInput {
  exercise: Exercise;
  result: ScoreBreakdown;
  mode: AttemptMode;
  bpm: number;
  claps: number[];
  noMetronome: boolean;
}

export interface RecordOutcome {
  record: AttemptRecord;
  stars: number;
  newAchievements: string[];
  levelUp: LevelId | null;
  xpGained: number;
  cloudError?: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface Store {
  storageOk: boolean;
  backend: 'local' | 'supabase';
  cloudUser: cloud.CloudUser | null;
  online: boolean;
  profiles: StudentProfile[];
  profile: StudentProfile;
  setActiveProfile: (id: string) => void;
  createProfile: (name: string, avatar: string) => StudentProfile;
  updateProfile: (patch: Partial<Pick<StudentProfile, 'displayName' | 'avatar'>>) => void;
  deleteProfile: (id: string) => void;
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  config: TeacherConfig;
  updateConfig: (patch: Partial<TeacherConfig>) => void;
  resetConfig: () => void;
  exercises: Exercise[];
  hiddenBuiltins: string[];
  getExercise: (id: string) => Exercise | undefined;
  saveExercise: (ex: Exercise) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  restoreBuiltins: () => void;
  attempts: AttemptRecord[];
  myAttempts: AttemptRecord[];
  recordAttempt: (i: RecordInput) => Promise<RecordOutcome>;
  completeDaily: () => string[];
  recordChallenge: (avg: number) => string[];
  cloudSignIn: (email: string, pw: string) => Promise<void>;
  cloudSignUp: (email: string, pw: string, name: string) => Promise<string>;
  cloudSignOut: () => Promise<void>;
  refreshCloudExercises: () => Promise<void>;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp mesti digunakan dalam <AppStoreProvider>');
  return s;
}

function sortExercises(list: Exercise[]): Exercise[] {
  return [...list].sort((a, b) => a.level - b.level || (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [storageOk] = useState(() => storageAvailable());
  const [profiles, setProfiles] = useState<StudentProfile[]>(() => {
    const p = loadJSON<StudentProfile[]>('profiles', []);
    return p.length ? p : [newProfile('Murid 1', 'drum')];
  });
  const [activeId, setActiveId] = useState<string>(() => loadJSON<string>('activeProfileId', ''));
  const [settings, setSettings] = useState<UserSettings>(() => ({ ...DEFAULT_SETTINGS, ...loadJSON<Partial<UserSettings>>('settings', {}) }));
  const [config, setConfig] = useState<TeacherConfig>(() => {
    const c = loadJSON<Partial<TeacherConfig>>('teacherConfig', {});
    return { ...DEFAULT_CONFIG, ...c, scoring: { ...DEFAULT_SCORING, ...(c.scoring ?? {}), weights: { ...DEFAULT_SCORING.weights, ...(c.scoring?.weights ?? {}) } } };
  });
  const [custom, setCustom] = useState<Exercise[]>(() => loadJSON<Exercise[]>('customExercises', []));
  const [hidden, setHidden] = useState<string[]>(() => loadJSON<string[]>('hiddenExercises', []));
  const [cloudExercises, setCloudExercises] = useState<Exercise[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>(() => loadJSON<AttemptRecord[]>('attempts', []));
  const [cloudUser, setCloudUser] = useState<cloud.CloudUser | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  // Simpan secara setempat
  useEffect(() => void saveJSON('profiles', profiles), [profiles]);
  useEffect(() => void saveJSON('activeProfileId', activeId), [activeId]);
  useEffect(() => void saveJSON('settings', settings), [settings]);
  useEffect(() => void saveJSON('teacherConfig', config), [config]);
  useEffect(() => void saveJSON('customExercises', custom), [custom]);
  useEffect(() => void saveJSON('hiddenExercises', hidden), [hidden]);
  useEffect(() => void saveJSON('attempts', attempts.slice(0, 2000)), [attempts]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Kurangkan animasi: tetapan pengguna ATAU keutamaan sistem
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion || !!mq?.matches);
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [settings.reducedMotion]);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const profile = useMemo(() => profiles.find((p) => p.id === activeId) ?? profiles[0]!, [profiles, activeId]);

  // ---------------- Latihan ----------------
  const exercises = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const e of VALID_BUILTIN_EXERCISES) if (!hidden.includes(e.id)) map.set(e.id, e);
    for (const e of [...custom, ...cloudExercises]) {
      if (hidden.includes(e.id)) continue;
      // Pola tidak sah TIDAK digunakan sebagai latihan aktif
      if (validateExercise(e).length === 0) map.set(e.id, e);
    }
    return sortExercises([...map.values()]);
  }, [custom, cloudExercises, hidden]);

  const getExercise = useCallback(
    (id: string) => exercises.find((e) => e.id === id) ?? custom.find((e) => e.id === id) ?? VALID_BUILTIN_EXERCISES.find((e) => e.id === id),
    [exercises, custom],
  );

  const backend: 'local' | 'supabase' = isSupabaseConfigured && cloudUser ? 'supabase' : 'local';

  const saveExercise = useCallback(
    async (ex: Exercise) => {
      const issues = validateExercise(ex);
      if (issues.length) throw new Error(issues.map((i) => i.message).join(' '));
      const stamped: Exercise = { ...ex, custom: true, updatedAt: new Date().toISOString(), createdAt: ex.createdAt ?? new Date().toISOString() };
      if (backend === 'supabase' && cloudUser?.role === 'teacher') {
        await cloud.cloudUpsertExercise(stamped);
        setCloudExercises((list) => [...list.filter((e) => e.id !== ex.id), stamped]);
      } else {
        setCustom((list) => [...list.filter((e) => e.id !== ex.id), stamped]);
      }
      setHidden((h) => h.filter((x) => x !== ex.id));
    },
    [backend, cloudUser],
  );

  const deleteExercise = useCallback(
    async (id: string) => {
      if (backend === 'supabase' && cloudExercises.some((e) => e.id === id)) {
        await cloud.cloudDeleteExercise(id);
        setCloudExercises((l) => l.filter((e) => e.id !== id));
        return;
      }
      const isCustom = custom.some((e) => e.id === id);
      setCustom((l) => l.filter((e) => e.id !== id));
      // Latihan terbina dalam disembunyikan (boleh dipulihkan)
      if (!isCustom || VALID_BUILTIN_EXERCISES.some((e) => e.id === id)) {
        if (VALID_BUILTIN_EXERCISES.some((e) => e.id === id)) setHidden((h) => [...new Set([...h, id])]);
      }
    },
    [backend, cloudExercises, custom],
  );

  const restoreBuiltins = useCallback(() => {
    setHidden([]);
    setCustom((l) => l.filter((e) => !VALID_BUILTIN_EXERCISES.some((b) => b.id === e.id)));
  }, []);

  // ---------------- Profil ----------------
  const createProfile = useCallback((name: string, avatar: string) => {
    const p = newProfile(name.trim() || 'Murid', avatar);
    setProfiles((l) => [...l, p]);
    setActiveId(p.id);
    return p;
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<Pick<StudentProfile, 'displayName' | 'avatar'>>) => {
      setProfiles((l) => l.map((p) => (p.id === profile.id ? { ...p, ...patch } : p)));
      if (cloudUser && cloudUser.id === profile.id) {
        void cloud.cloudUpdateProfile(profile.id, patch.displayName ?? profile.displayName, patch.avatar ?? profile.avatar).catch(() => undefined);
      }
    },
    [profile, cloudUser],
  );

  const deleteProfile = useCallback(
    (id: string) => {
      setProfiles((l) => {
        const next = l.filter((p) => p.id !== id);
        return next.length ? next : [newProfile('Murid 1', 'drum')];
      });
      setAttempts((a) => a.filter((x) => x.profileId !== id));
      if (id === activeId) setActiveId('');
    },
    [activeId],
  );

  const updateSettings = useCallback((patch: Partial<UserSettings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const updateConfig = useCallback((patch: Partial<TeacherConfig>) => setConfig((c) => ({ ...c, ...patch })), []);
  const resetConfig = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  const myAttempts = useMemo(() => attempts.filter((a) => a.profileId === profile.id), [attempts, profile.id]);

  // ---------------- Rekod percubaan ----------------
  const recordAttempt = useCallback(
    async (i: RecordInput): Promise<RecordOutcome> => {
      const stars = computeStars(i.result.total, i.exercise.passMark);
      const record: AttemptRecord = {
        id: uid('a-'),
        profileId: profile.id,
        profileName: profile.displayName,
        exerciseId: i.exercise.id,
        exerciseTitle: i.exercise.title,
        level: i.exercise.level,
        mode: i.mode,
        tempoBpm: i.bpm,
        patternScore: i.result.pattern,
        timingScore: i.result.timing,
        stabilityScore: i.result.stability,
        totalScore: i.result.total,
        stars,
        detectedClaps: i.claps.map((t) => Math.round(t * 1000) / 1000),
        counts: i.result.counts,
        createdAt: new Date().toISOString(),
        synced: false,
      };
      const allMine = [record, ...myAttempts];
      const newLevel = computeUnlockedLevel(allMine, exercises, config.unlockPassCount, profile.unlockedLevel);
      const levelUp = newLevel > profile.unlockedLevel ? newLevel : null;
      const newAch = evaluateAchievements({
        profile,
        attempts: allMine,
        exercise: i.exercise,
        result: i.result,
        mode: i.mode,
        noMetronome: i.noMetronome,
        newUnlockedLevel: newLevel,
      });
      const xpGained = xpFor(i.result, stars);
      const now = new Date().toISOString();
      setProfiles((l) =>
        l.map((p) =>
          p.id === profile.id
            ? {
                ...p,
                xp: p.xp + xpGained,
                unlockedLevel: Math.max(p.unlockedLevel, newLevel) as LevelId,
                achievements: { ...p.achievements, ...Object.fromEntries(newAch.map((c) => [c, now])) },
              }
            : p,
        ),
      );

      let cloudError: string | undefined;
      if (backend === 'supabase' && cloudUser && cloudUser.id === profile.id) {
        try {
          await cloud.cloudSubmitAttempt(record);
          record.synced = true;
          for (const c of newAch) void cloud.cloudUnlockAchievement(cloudUser.id, c).catch(() => undefined);
        } catch (e) {
          cloudError = (e as Error).message;
        }
      }
      setAttempts((a) => [record, ...a]);
      return { record, stars, newAchievements: newAch, levelUp, xpGained, cloudError };
    },
    [profile, myAttempts, exercises, config.unlockPassCount, backend, cloudUser],
  );

  const completeDaily = useCallback((): string[] => {
    const key = todayKey();
    const hist = profile.dailyHistory.includes(key) ? profile.dailyHistory : [...profile.dailyHistory, key];
    const streak = dailyStreak(hist);
    const add = streak >= 3 && !profile.achievements.DAILY_3 ? ['DAILY_3'] : [];
    const now = new Date().toISOString();
    setProfiles((l) =>
      l.map((p) =>
        p.id === profile.id
          ? { ...p, dailyHistory: hist.slice(-120), achievements: { ...p.achievements, ...Object.fromEntries(add.map((c) => [c, now])) } }
          : p,
      ),
    );
    return add;
  }, [profile]);

  const recordChallenge = useCallback(
    (avg: number): string[] => {
      if (avg < 80 || profile.achievements.CHALLENGE_WIN) return [];
      const now = new Date().toISOString();
      setProfiles((l) => l.map((p) => (p.id === profile.id ? { ...p, achievements: { ...p.achievements, CHALLENGE_WIN: now } } : p)));
      return ['CHALLENGE_WIN'];
    },
    [profile],
  );

  // ---------------- Supabase ----------------
  const attachCloudUser = useCallback((u: cloud.CloudUser) => {
    setCloudUser(u);
    setProfiles((l) => {
      const existing = l.find((p) => p.id === u.id);
      if (existing) return l.map((p) => (p.id === u.id ? { ...p, displayName: u.displayName, role: u.role, avatar: u.avatar } : p));
      return [...l, newProfile(u.displayName, u.avatar, u.role, u.id)];
    });
    setActiveId(u.id);
  }, []);

  const refreshCloudExercises = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      setCloudExercises(await cloud.cloudFetchExercises());
    } catch {
      /* luar talian atau jadual belum wujud — teruskan dengan latihan tempatan */
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    void (async () => {
      try {
        const u = await cloud.cloudSession();
        if (alive && u) attachCloudUser(u);
      } catch {
        /* abaikan */
      }
      await refreshCloudExercises();
    })();
    return () => {
      alive = false;
    };
  }, [attachCloudUser, refreshCloudExercises]);

  const cloudSignIn = useCallback(
    async (email: string, pw: string) => {
      const u = await cloud.cloudSignIn(email, pw);
      attachCloudUser(u);
      await refreshCloudExercises();
    },
    [attachCloudUser, refreshCloudExercises],
  );
  const cloudSignUp = useCallback((email: string, pw: string, name: string) => cloud.cloudSignUp(email, pw, name), []);
  const cloudSignOut = useCallback(async () => {
    await cloud.cloudSignOut();
    setCloudUser(null);
    setActiveId('');
  }, []);

  const value: Store = {
    storageOk,
    backend,
    cloudUser,
    online,
    profiles,
    profile,
    setActiveProfile: setActiveId,
    createProfile,
    updateProfile,
    deleteProfile,
    settings,
    updateSettings,
    config,
    updateConfig,
    resetConfig,
    exercises,
    hiddenBuiltins: hidden,
    getExercise,
    saveExercise,
    deleteExercise,
    restoreBuiltins,
    attempts,
    myAttempts,
    recordAttempt,
    completeDaily,
    recordChallenge,
    cloudSignIn,
    cloudSignUp,
    cloudSignOut,
    refreshCloudExercises,
    toasts,
    toast,
    dismissToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
