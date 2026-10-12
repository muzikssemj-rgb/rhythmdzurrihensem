import { describe, expect, it } from 'vitest';
import { ClapGestureDetector, type Pt } from './clapGesture';

// Tangan sintetik: 21 titik di sekitar pusat (cx, cy), skala 0.1
function hand(cx: number, cy: number): Pt[] {
  return Array.from({ length: 21 }, (_, i) => ({ x: cx + (i === 9 ? 0 : 0), y: cy + (i === 0 ? 0.05 : i === 9 ? -0.05 : 0) }));
}

describe('ClapGestureDetector', () => {
  it('mengesan satu tepuk apabila tangan bergerak dari terbuka ke bertemu', () => {
    const d = new ClapGestureDetector();
    const frames = [0.3, 0.25, 0.18, 0.1, 0.04, 0.02, 0.03, 0.1, 0.25];
    const events = frames.map((gap, i) => d.update([hand(0.5 - gap, 0.5), hand(0.5 + gap, 0.5)], i * 33));
    expect(events.filter(Boolean)).toHaveLength(1);
  });
  it('tiada tepuk jika hanya satu tangan dikesan', () => {
    const d = new ClapGestureDetector();
    expect([0, 33, 66].map((t) => d.update([hand(0.5, 0.5)], t)).some(Boolean)).toBe(false);
  });
  it('tangan yang sentiasa rapat (tanpa gerakan) bukan tepuk', () => {
    const d = new ClapGestureDetector();
    const ev = Array.from({ length: 30 }, (_, i) => d.update([hand(0.49, 0.5), hand(0.51, 0.5)], i * 33));
    expect(ev.some(Boolean)).toBe(false);
  });
  it('mengesan dua tepuk berturut-turut', () => {
    const d = new ClapGestureDetector();
    const gaps = [0.3, 0.15, 0.02, 0.15, 0.3, 0.15, 0.02, 0.2];
    const ev = gaps.map((g, i) => d.update([hand(0.5 - g, 0.5), hand(0.5 + g, 0.5)], i * 60));
    expect(ev.filter(Boolean)).toHaveLength(2);
  });
});
