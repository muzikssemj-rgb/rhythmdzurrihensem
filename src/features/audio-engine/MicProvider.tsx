import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ensureAudioRunning } from './audioContext';
import { MicClapInput, MicError, checkMicSupport } from './micClapInput';
import { useApp } from '@/app/AppStore';

export type MicStatus = 'idle' | 'requesting' | 'ready' | 'error';

export interface MicState {
  status: MicStatus;
  error: MicError | null;
  input: MicClapInput | null;
  /** Minta kebenaran & mulakan mikrofon (mesti dari interaksi pengguna). */
  request: () => Promise<MicClapInput | null>;
  /** Hentikan mikrofon (lampu penunjuk mikrofon pelayar akan padam). */
  release: () => void;
  supportError: MicError | null;
}

export const MicContext = createContext<MicState | null>(null);

export function MicProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<MicError | null>(null);
  const [input, setInput] = useState<MicClapInput | null>(null);
  const inputRef = useRef<MicClapInput | null>(null);
  const [supportError] = useState(() => checkMicSupport());

  // Terapkan tetapan pengesanan setiap kali ia berubah
  useEffect(() => {
    input?.detector.configure({
      refractoryMs: settings.refractoryMs,
      sensitivity: settings.sensitivity,
      calibratedThresholdDb: settings.clapThreshold,
    });
  }, [input, settings.refractoryMs, settings.sensitivity, settings.clapThreshold]);

  const request = useCallback(async () => {
    if (inputRef.current?.active) return inputRef.current;
    setStatus('requesting');
    setError(null);
    try {
      const ctx = await ensureAudioRunning();
      const inst = await MicClapInput.create(ctx, {
        refractoryMs: settings.refractoryMs,
        sensitivity: settings.sensitivity,
        calibratedThresholdDb: settings.clapThreshold,
      });
      // Jika mikrofon diputuskan (cth. dicabut), kemas kini status
      inst.stream.getAudioTracks().forEach((t) =>
        t.addEventListener('ended', () => {
          setStatus('error');
          setError(new MicError('notfound', 'Mikrofon terputus. Sambungkan semula dan tekan "Cuba Lagi".'));
          setInput(null);
          inputRef.current = null;
        }),
      );
      inputRef.current = inst;
      setInput(inst);
      setStatus('ready');
      return inst;
    } catch (e) {
      const err = e instanceof MicError ? e : new MicError('unknown', (e as Error)?.message ?? 'Ralat tidak diketahui');
      setError(err);
      setStatus('error');
      return null;
    }
  }, [settings.refractoryMs, settings.sensitivity, settings.clapThreshold]);

  const release = useCallback(() => {
    inputRef.current?.stop();
    inputRef.current = null;
    setInput(null);
    setStatus('idle');
  }, []);

  useEffect(() => () => inputRef.current?.stop(), []);

  return <MicContext.Provider value={{ status, error, input, request, release, supportError }}>{children}</MicContext.Provider>;
}
