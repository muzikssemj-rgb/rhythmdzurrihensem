import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'off' | 'starting' | 'on' | 'error';

export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'Kamera memerlukan sambungan selamat (HTTPS) atau localhost.';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Akses kamera ditolak. Benarkan kamera melalui tetapan pelayar, kemudian cuba lagi. Latihan mikrofon masih boleh diteruskan.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Tiada kamera ditemui pada peranti ini. Anda masih boleh berlatih menggunakan mikrofon sahaja.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut dan cuba lagi.';
    default:
      return 'Kamera tidak dapat dimulakan. Anda masih boleh berlatih menggunakan mikrofon sahaja.';
  }
}

/** Urus aliran kamera hadapan. Kegagalan kamera TIDAK menjejaskan latihan mikrofon. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
  }, []);

  const start = useCallback(
    async (face: 'user' | 'environment' = facing) => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setError(cameraErrorMessage(null));
        setStatus('error');
        return false;
      }
      setStatus('starting');
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: face, width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30, max: 30 } },
          audio: false,
        });
        streamRef.current = stream;
        setFacing(face);
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.muted = true;
          v.playsInline = true;
          await v.play().catch(() => undefined);
        }
        setStatus('on');
        return true;
      } catch (e) {
        setError(cameraErrorMessage(e));
        setStatus('error');
        return false;
      }
    },
    [facing],
  );

  // Pastikan video disambung jika elemen dipasang selepas aliran bermula
  const attach = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.muted = true;
      el.playsInline = true;
      void el.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return { videoRef, attach, status, error, start, stop, facing, flip: () => start(facing === 'user' ? 'environment' : 'user') };
}
