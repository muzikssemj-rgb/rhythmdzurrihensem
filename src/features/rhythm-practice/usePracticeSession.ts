import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AttemptMode, Exercise, ScoreBreakdown } from '@/types';
import { useApp, type RecordOutcome } from '@/app/AppStore';
import { ensureAudioRunning, isAudioSupported } from '@/features/audio-engine/audioContext';
import { useClapDetection } from '@/features/audio-engine/useClapDetection';
import { mergeScoring, scorePerformance } from '@/features/scoring/scoringEngine';
import { PerformanceSession, type SessionMode, type SessionPhase, type SessionSnapshot } from './sessionEngine';
import { scheduleChime } from '@/features/audio-engine/synth';

export type LiveJudgement = 'perfect' | 'ontime' | 'early' | 'late' | 'extra' | 'rest';

export interface SessionResult {
  exerciseId: string;
  breakdown: ScoreBreakdown;
  bpm: number;
  mode: AttemptMode;
  runMode: SessionMode;
  noMetronome: boolean;
  claps: number[];
  outcome: RecordOutcome | null;
  camera: { active: boolean; confirmed: number; audioClaps: number; gestures: number } | null;
  challenge?: { step: number; total: number; scores: number[]; ids: string[] };
}

export interface UsePracticeSessionOptions {
  exercise: Exercise | undefined;
  mode: AttemptMode;
  bpm: number;
  metronomeDuringPerformance: boolean;
  /** Dipanggil apabila latihan tamat (selepas markah dikira & disimpan). */
  onComplete: (r: SessionResult) => void;
  cameraActive?: boolean;
}

/** Logik sesi latihan dikongsi oleh Rhythm Practice, AR Arena, Cabaran, Harian & Master. */
export function usePracticeSession(o: UsePracticeSessionOptions) {
  const { settings, config, recordAttempt } = useApp();
  const mic = useClapDetection();
  const sessionRef = useRef<PerformanceSession | null>(null);
  const [phase, setPhase] = useState<SessionPhase | 'idle' | 'scoring'>('idle');
  const [runMode, setRunMode] = useState<SessionMode>('live');
  const [judgement, setJudgement] = useState<{ j: LiveJudgement; n: number; deltaMs?: number } | null>(null);
  const [combo, setCombo] = useState(0);
  const [clapCount, setClapCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef(o);
  optsRef.current = o;

  const scoring = useMemo(() => mergeScoring(config.scoring, o.exercise?.scoringOverride), [config.scoring, o.exercise]);

  const finish = useCallback(
    async (s: PerformanceSession) => {
      const opts = optsRef.current;
      const ex = opts.exercise!;
      setPhase('scoring');
      const claps = s.relativeClaps();
      const breakdown = scorePerformance(s.expected, claps, scoring, { bpm: s.opts.bpm, endTime: s.durationSec });
      // Pengesahan kamera (maklumat tambahan — TIDAK menjejaskan markah)
      let camera: SessionResult['camera'] = null;
      if (opts.cameraActive) {
        const cam = s.relativeCameraClaps();
        const confirmed = breakdown.hits.filter((h) => cam.some((c) => Math.abs(c - h.clapTime) < 0.18)).length;
        camera = { active: true, confirmed, audioClaps: claps.length, gestures: cam.length };
      }
      let outcome: RecordOutcome | null = null;
      if (s.opts.mode === 'live') {
        outcome = await recordAttempt({
          exercise: ex,
          result: breakdown,
          mode: opts.mode,
          bpm: s.opts.bpm,
          claps,
          noMetronome: !s.opts.metronomeDuringPerformance,
        });
      }
      try {
        const ctx = await ensureAudioRunning();
        const g = ctx.createGain();
        g.gain.value = settings.metronomeVolume;
        g.connect(ctx.destination);
        scheduleChime(ctx, g, ctx.currentTime + 0.05, breakdown.total >= ex.passMark);
      } catch {
        /* abaikan */
      }
      sessionRef.current = null;
      setPhase('finished');
      opts.onComplete({
        exerciseId: ex.id,
        breakdown,
        bpm: s.opts.bpm,
        mode: opts.mode,
        runMode: s.opts.mode,
        noMetronome: !s.opts.metronomeDuringPerformance,
        claps,
        outcome,
        camera,
      });
    },
    [scoring, recordAttempt, settings.metronomeVolume],
  );

  const start = useCallback(
    async (rm: SessionMode = 'live') => {
      const ex = optsRef.current.exercise;
      if (!ex) return;
      setError(null);
      if (!isAudioSupported()) {
        setError('Pelayar ini tidak menyokong Web Audio API. Gunakan Chrome, Edge, Safari atau Firefox terkini.');
        return;
      }
      sessionRef.current?.stop();
      const ctx = await ensureAudioRunning();
      if (ctx.state !== 'running') {
        setError('Audio belum diaktifkan. Ketik butang sekali lagi untuk membenarkan bunyi.');
        return;
      }
      let input = mic.input;
      if (rm === 'live' && !input) {
        input = await mic.request();
        if (!input) {
          setError('Mikrofon diperlukan untuk penilaian sebenar. Benarkan mikrofon atau pilih Mod Demo (simulasi).');
          return;
        }
      }
      const s = new PerformanceSession(ctx, {
        exercise: ex,
        bpm: optsRef.current.bpm,
        countInBars: config.countInBars,
        metronomeDuringPerformance: optsRef.current.metronomeDuringPerformance,
        metronomeVolume: settings.metronomeVolume,
        latencyOffsetMs: settings.latencyOffsetMs,
        mode: rm,
        input: rm === 'live' ? input : null,
      });
      // Penilaian langsung untuk maklum balas visual (markah rasmi dikira oleh scoringEngine pada akhir)
      const targets = s.expected.filter((e) => e.type === 'clap');
      const rests = s.expected.filter((e) => e.type === 'rest');
      let comboN = 0;
      let n = 0;
      const used = new Set<number>();
      s.onClap((t) => {
        n++;
        setClapCount(n);
        if (t < -scoring.maxWindowMs / 1000) return; // semasa kiraan masuk
        let best = -1;
        let bd = Infinity;
        targets.forEach((tg, i) => {
          if (used.has(i)) return;
          const d = Math.abs(t - tg.time);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        let j: LiveJudgement;
        const deltaMs = best >= 0 ? (t - targets[best]!.time) * 1000 : undefined;
        if (best >= 0 && bd * 1000 <= scoring.maxWindowMs) {
          used.add(best);
          const a = Math.abs(deltaMs!);
          j = a <= scoring.perfectMs ? 'perfect' : a <= scoring.toleranceMs ? 'ontime' : deltaMs! < 0 ? 'early' : 'late';
        } else {
          j = rests.some((r) => t >= r.time && t < r.time + r.duration) ? 'rest' : 'extra';
        }
        comboN = j === 'perfect' || j === 'ontime' ? comboN + 1 : 0;
        setCombo(comboN);
        setJudgement({ j, n, deltaMs });
      });
      s.onFinish = () => void finish(s);
      sessionRef.current = s;
      setRunMode(rm);
      setCombo(0);
      setClapCount(0);
      setJudgement(null);
      s.start();
      setPhase('countin');
    },
    [mic, config.countInBars, settings.metronomeVolume, settings.latencyOffsetMs, scoring, finish],
  );

  // Kemas kini fasa (countin → playing) tanpa render setiap frame
  useEffect(() => {
    if (phase !== 'countin' && phase !== 'playing') return;
    const id = window.setInterval(() => {
      const s = sessionRef.current;
      if (s && (s.phase === 'countin' || s.phase === 'playing') && s.phase !== phase) setPhase(s.phase);
    }, 60);
    return () => window.clearInterval(id);
  }, [phase]);

  const pause = useCallback(async () => {
    await sessionRef.current?.pause();
    setPhase('paused');
  }, []);
  const resume = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    await s.resume();
    setPhase(s.phase);
  }, []);
  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPhase('idle');
    setJudgement(null);
  }, []);
  const tap = useCallback(() => sessionRef.current?.tap(), []);

  // Hentikan sesi apabila komponen dinyahlekap
  useEffect(
    () => () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
    },
    [],
  );

  const getMusicTime = useCallback((): number | null => {
    const s = sessionRef.current;
    if (!s || s.phase === 'ready' || s.phase === 'stopped') return null;
    return s.snapshot().musicTime;
  }, []);

  const getSnapshot = useCallback((): SessionSnapshot | null => sessionRef.current?.snapshot() ?? null, []);
  const addCameraClap = useCallback((ctxTime: number) => sessionRef.current?.addCameraClap(ctxTime), []);
  const getSession = useCallback(() => sessionRef.current, []);

  const active = phase === 'countin' || phase === 'playing' || phase === 'paused';
  return { phase, active, runMode, start, pause, resume, stop, tap, judgement, combo, clapCount, error, getMusicTime, getSnapshot, addCameraClap, getSession, scoring };
}
