import { useCallback, useEffect, useRef, useState } from 'react';
import type { Exercise } from '@/types';
import { ensureAudioRunning, isAudioSupported } from '@/features/audio-engine/audioContext';
import { playExample } from './sessionEngine';
import { useApp } from '@/app/AppStore';

/** Main "Dengar Contoh" — bunyi tepukan sintetik + kiraan masuk, diselaraskan dengan penunjuk skor. */
export function useExamplePlayer() {
  const { settings, config } = useApp();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const handle = useRef<{ stop: () => void; musicStart: number; end: number; ctx: AudioContext } | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
    if (timer.current) window.clearTimeout(timer.current);
    setPlayingId(null);
  }, []);

  const play = useCallback(
    async (ex: Exercise, bpm = ex.tempoBpm, withMetronome = true) => {
      stop();
      if (!isAudioSupported()) return false;
      const ctx = await ensureAudioRunning();
      const h = playExample(ctx, ex, bpm, {
        withMetronome,
        volume: settings.exampleVolume,
        metronomeVolume: settings.metronomeVolume,
        countInBars: config.countInBars,
      });
      handle.current = { ...h, ctx };
      setPlayingId(ex.id);
      timer.current = window.setTimeout(() => {
        handle.current = null;
        setPlayingId(null);
      }, (h.end - ctx.currentTime + 0.3) * 1000);
      return true;
    },
    [stop, settings.exampleVolume, settings.metronomeVolume, config.countInBars],
  );

  const getMusicTime = useCallback((): number | null => {
    const h = handle.current;
    if (!h) return null;
    return h.ctx.currentTime - h.musicStart;
  }, []);

  useEffect(() => stop, [stop]);
  return { playingId, play, stop, getMusicTime };
}
