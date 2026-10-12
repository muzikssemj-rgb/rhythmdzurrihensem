import { useContext, useEffect, useRef, useState } from 'react';
import { MicContext, type MicState } from './MicProvider';
import type { ClapOnset } from './clapDetectionEngine';

/** Akses mikrofon/pengesan tepukan global. */
export function useClapDetection(): MicState {
  const m = useContext(MicContext);
  if (!m) throw new Error('useClapDetection mesti digunakan dalam <MicProvider>');
  return m;
}

/** Aras mikrofon (dB) dikemas kini ~15 fps untuk meter visual. */
export function useMicLevel(): number {
  const { input } = useClapDetection();
  const [lvl, setLvl] = useState(-100);
  useEffect(() => {
    if (!input) return;
    const id = window.setInterval(() => setLvl(input.levelDb), 66);
    return () => window.clearInterval(id);
  }, [input]);
  return lvl;
}

/** Panggil fn setiap kali tepukan dikesan (contoh: ujian sensitiviti). */
export function useOnClap(fn: (o: ClapOnset) => void, enabled = true) {
  const { input } = useClapDetection();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!input || !enabled) return;
    return input.onClap((o) => ref.current(o));
  }, [input, enabled]);
}
