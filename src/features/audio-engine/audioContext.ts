// Satu AudioContext dikongsi untuk metronom, audio contoh dan input mikrofon
// supaya semua cap masa berada pada JAM AUDIO yang sama (ctx.currentTime).

let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;

export function isAudioSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext);
}

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    const Ctor: AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'interactive' });
  }
  return ctx;
}

/** Mesti dipanggil daripada interaksi pengguna (klik/ketik) — dasar autoplay pelayar. */
export async function ensureAudioRunning(): Promise<AudioContext> {
  const c = getAudioContext();
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      /* diabaikan — akan dicuba semula pada interaksi seterusnya */
    }
  }
  return c;
}

export function outputLatencySec(c: AudioContext): number {
  const o = (c as AudioContext & { outputLatency?: number }).outputLatency;
  return (Number.isFinite(o) ? (o as number) : 0) + (c.baseLatency || 0);
}
