// ============================================================
// Pengesan gerakan tepuk daripada titik sendi tangan (tulen, boleh diuji).
// Gerakan TIDAK dianggap bukti tepukan — mikrofon kekal sumber utama.
// Kamera hanya mengesahkan/visualisasi gerakan.
// ============================================================

export interface Pt {
  x: number;
  y: number;
  z?: number;
}

const PALM = [0, 5, 9, 13, 17];

export function palmCenter(hand: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const i of PALM) {
    x += hand[i]?.x ?? 0;
    y += hand[i]?.y ?? 0;
  }
  return { x: x / PALM.length, y: y / PALM.length };
}

export function handScale(hand: Pt[]): number {
  const a = hand[0];
  const b = hand[9];
  if (!a || !b) return 0.1;
  return Math.hypot(a.x - b.x, a.y - b.y) || 0.1;
}

export interface GestureConfig {
  /** Jarak ternormal "tangan terbuka". */
  openRatio: number;
  /** Jarak ternormal "tangan bertemu". */
  closeRatio: number;
  /** Tempoh maksimum dari terbuka ke tertutup (ms). */
  maxCloseMs: number;
  refractoryMs: number;
}

export const DEFAULT_GESTURE: GestureConfig = { openRatio: 1.5, closeRatio: 0.95, maxCloseMs: 700, refractoryMs: 160 };

export class ClapGestureDetector {
  private lastOpenAt = -Infinity;
  private closed = false;
  private lastClapAt = -Infinity;
  lastRatio: number | null = null;
  constructor(private cfg: GestureConfig = DEFAULT_GESTURE) {}

  /** Kembalikan true jika gerakan tepuk berlaku pada frame ini. tMs = masa (ms). */
  update(hands: Pt[][], tMs: number): boolean {
    if (hands.length < 2) {
      this.lastRatio = null;
      return false;
    }
    const [h1, h2] = hands as [Pt[], Pt[]];
    const c1 = palmCenter(h1);
    const c2 = palmCenter(h2);
    const scale = (handScale(h1) + handScale(h2)) / 2;
    const r = Math.hypot(c1.x - c2.x, c1.y - c2.y) / scale;
    this.lastRatio = r;
    if (r > this.cfg.openRatio) {
      this.lastOpenAt = tMs;
      this.closed = false;
      return false;
    }
    if (!this.closed && r < this.cfg.closeRatio && tMs - this.lastOpenAt <= this.cfg.maxCloseMs && tMs - this.lastClapAt >= this.cfg.refractoryMs) {
      this.closed = true;
      this.lastClapAt = tMs;
      return true;
    }
    return false;
  }
}
