import {
  BLOCK,
  CLAP_WORKLET_SOURCE,
  ClapDetector,
  FeatureExtractor,
  HIGHPASS_HZ,
  designHighpass,
  toDb,
  type ClapDetectorConfig,
  type ClapOnset,
  type FeatureFrame,
} from './clapDetectionEngine';

// ============================================================
// Input mikrofon → ciri audio (AudioWorklet) → ClapDetector
// Audio mentah TIDAK dirakam, disimpan atau dimuat naik. Hanya cap masa tepukan
// yang dikesan disimpan dalam memori.
// ============================================================

export type MicErrorCode =
  | 'insecure'
  | 'unsupported'
  | 'denied'
  | 'notfound'
  | 'busy'
  | 'unknown';

export class MicError extends Error {
  constructor(public code: MicErrorCode, message: string) {
    super(message);
  }
}

export function micErrorFrom(err: unknown): MicError {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new MicError('denied', 'Akses mikrofon ditolak. Benarkan mikrofon melalui ikon kunci/kamera di bar alamat pelayar, kemudian tekan "Cuba Lagi".');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new MicError('notfound', 'Tiada mikrofon ditemui pada peranti ini. Sambungkan mikrofon atau gunakan peranti lain.');
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new MicError('busy', 'Mikrofon sedang digunakan oleh aplikasi lain (cth. Zoom/Meet). Tutup aplikasi tersebut dan cuba lagi.');
    case 'SecurityError':
      return new MicError('insecure', 'Mikrofon memerlukan sambungan selamat (HTTPS) atau localhost.');
    default:
      return new MicError('unknown', `Mikrofon tidak dapat dimulakan${(err as Error)?.message ? `: ${(err as Error).message}` : ''}.`);
  }
}

export function checkMicSupport(): MicError | null {
  if (typeof window === 'undefined') return new MicError('unsupported', 'Persekitaran tidak disokong.');
  if (!window.isSecureContext) return new MicError('insecure', 'Mikrofon dan kamera hanya berfungsi melalui HTTPS (atau http://localhost semasa pembangunan).');
  if (!navigator.mediaDevices?.getUserMedia) return new MicError('unsupported', 'Pelayar ini tidak menyokong akses mikrofon. Gunakan Chrome, Edge, Safari atau Firefox terkini.');
  return null;
}

const registeredCtx = new WeakSet<BaseAudioContext>();

export class MicClapInput {
  readonly detector: ClapDetector;
  private node: AudioWorkletNode | ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private listeners = new Set<(o: ClapOnset) => void>();
  private frameListeners = new Set<(f: FeatureFrame) => void>();
  /** Aras terkini (dB jalur tinggi) untuk meter visual. */
  levelDb = -100;
  private blobUrl: string | null = null;
  usingWorklet = false;
  /** Bila false, onset tidak dihantar (cth. semasa audio contoh dimainkan). */
  enabled = true;

  private constructor(public ctx: AudioContext, public stream: MediaStream, cfg: Partial<ClapDetectorConfig>) {
    this.detector = new ClapDetector(cfg);
  }

  static async create(ctx: AudioContext, cfg: Partial<ClapDetectorConfig> = {}): Promise<MicClapInput> {
    const unsupported = checkMicSupport();
    if (unsupported) throw unsupported;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Matikan pemprosesan suara: ia meredam transien tepukan & mengubah aras.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      });
    } catch (e) {
      throw micErrorFrom(e);
    }
    const inst = new MicClapInput(ctx, stream, cfg);
    await inst.connect();
    return inst;
  }

  private async connect() {
    const ctx = this.ctx;
    this.source = ctx.createMediaStreamSource(this.stream);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);

    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        if (!registeredCtx.has(ctx)) {
          this.blobUrl = URL.createObjectURL(new Blob([CLAP_WORKLET_SOURCE], { type: 'application/javascript' }));
          await ctx.audioWorklet.addModule(this.blobUrl);
          registeredCtx.add(ctx);
        }
        const node = new AudioWorkletNode(ctx, 'clap-feature-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          processorOptions: { coeffs: designHighpass(HIGHPASS_HZ, ctx.sampleRate), batch: 6 },
        });
        node.port.onmessage = (ev: MessageEvent<Float64Array>) => {
          const d = ev.data;
          for (let i = 0; i + 3 < d.length; i += 4) {
            this.handleFrame({ time: d[i]!, hiEnergy: d[i + 1]!, fullEnergy: d[i + 2]!, peak: d[i + 3]! });
          }
        };
        this.source.connect(node).connect(this.sink);
        this.node = node;
        this.usingWorklet = true;
        return;
      } catch (e) {
        console.warn('[Mic] AudioWorklet gagal, guna ScriptProcessor sebagai sandaran', e);
      }
    }
    // Sandaran untuk pelayar lama
    const fx = new FeatureExtractor(ctx.sampleRate);
    const sp = ctx.createScriptProcessor(1024, 1, 1);
    sp.onaudioprocess = (ev) => {
      const data = ev.inputBuffer.getChannelData(0);
      // playbackTime ialah masa output; tolak tempoh buffer untuk menganggar masa input.
      const t0 = ev.playbackTime - data.length / ctx.sampleRate;
      for (let i = 0; i + BLOCK <= data.length; i += BLOCK) {
        this.handleFrame(fx.block(data, i, BLOCK, t0 + i / ctx.sampleRate));
      }
    };
    this.source.connect(sp).connect(this.sink);
    this.node = sp;
  }

  private handleFrame(f: FeatureFrame) {
    this.levelDb = toDb(f.hiEnergy);
    this.frameListeners.forEach((l) => l(f));
    const onset = this.detector.process(f);
    if (onset && this.enabled) this.listeners.forEach((l) => l(onset));
  }

  onClap(fn: (o: ClapOnset) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onFrame(fn: (f: FeatureFrame) => void): () => void {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  /** Kumpul frame untuk tempoh tertentu (kalibrasi). */
  collect(seconds: number): Promise<FeatureFrame[]> {
    return new Promise((resolve) => {
      const frames: FeatureFrame[] = [];
      const off = this.onFrame((f) => frames.push(f));
      window.setTimeout(() => {
        off();
        resolve(frames);
      }, seconds * 1000);
    });
  }

  stop() {
    try {
      if (this.node instanceof AudioWorkletNode) {
        this.node.port.postMessage('stop');
        this.node.port.onmessage = null;
      } else if (this.node) {
        (this.node as ScriptProcessorNode).onaudioprocess = null;
      }
      this.node?.disconnect();
      this.source?.disconnect();
      this.sink?.disconnect();
    } catch {
      /* abaikan */
    }
    this.stream.getTracks().forEach((t) => t.stop());
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.listeners.clear();
    this.frameListeners.clear();
  }

  get active() {
    return this.stream.getAudioTracks().some((t) => t.readyState === 'live');
  }
}
