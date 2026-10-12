import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Exercise, RhythmToken } from '@/types';
import { buildTimeline, meterLabel } from '@/lib/rhythm';

// ============================================================
// Notasi irama sebenar menggunakan VexFlow (fon muzik Bravura/SMuFL).
// Satu garisan (percussion) seperti kad irama di bilik darjah.
// ============================================================

type VF = typeof import('vexflow/bravura');
let vfPromise: Promise<VF> | null = null;
function loadVexFlow(): Promise<VF> {
  if (!vfPromise) {
    vfPromise = import('vexflow/bravura').then(async (mod) => {
      try {
        await mod.VexFlow.loadFonts('Bravura', 'Academico');
      } catch {
        /* fon terbenam — teruskan */
      }
      return mod;
    });
  }
  return vfPromise;
}

export type NoteMark = 'hit' | 'early' | 'late' | 'miss';

interface LayoutEvent {
  x: number;
  row: number;
}
interface LayoutRow {
  top: number;
  height: number;
  startX: number;
  endX: number;
}

export interface RhythmNotationProps {
  exercise: Exercise;
  bpm?: number;
  className?: string;
  light?: boolean;
  /** Tanda warna pada not (indeks token). */
  marks?: Record<number, NoteMark>;
  /** Dipanggil dalam rAF — kembalikan masa muzik (saat) atau null untuk sembunyikan penunjuk. */
  getMusicTime?: () => number | null;
  /** Lebar maksimum bar dalam satu baris. */
  maxBarsPerRow?: number;
  scale?: number;
  label?: string;
}

function durationCode(t: RhythmToken): string {
  return t.value + (t.rest ? 'r' : '');
}

export function RhythmNotation({ exercise, bpm, className = '', light = false, marks, getMusicTime, maxBarsPerRow = 4, scale = 1, label }: RhythmNotationProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const layoutRef = useRef<{ events: LayoutEvent[]; rows: LayoutRow[]; els: (SVGElement | undefined)[] }>({ events: [], rows: [], els: [] });
  const activeRef = useRef<number>(-1);
  const [rendered, setRendered] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]!.contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    });
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !svgHostRef.current) return;
    let cancelled = false;
    void loadVexFlow()
      .then((VF) => {
        if (cancelled || !svgHostRef.current) return;
        const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot, StaveTie, Fraction, TimeSignature } = VF;
        const host = svgHostRef.current;
        host.innerHTML = '';
        const W = width / scale;
        const bars = exercise.bars;
        // Lebar diperlukan setiap bar (lebih banyak not → lebih lebar)
        const need = bars.map((b, i) => 40 + b.length * 30 + (i === 0 ? 34 : 0));
        const rowsIdx: number[][] = [];
        let cur: number[] = [];
        let used = 0;
        bars.forEach((_, i) => {
          const n = need[i]!;
          if (cur.length && (used + n > W - 10 || cur.length >= maxBarsPerRow)) {
            rowsIdx.push(cur);
            cur = [];
            used = 0;
          }
          cur.push(i);
          used += need[i]!;
        });
        if (cur.length) rowsIdx.push(cur);

        const ROW_H = 80;
        const TOP = 6;
        const height = rowsIdx.length * ROW_H + TOP + 8;
        const renderer = new Renderer(host, Renderer.Backends.SVG);
        renderer.resize(W, height);
        const ctx = renderer.getContext();
        const svg = host.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', String(width));
          svg.setAttribute('height', String(height * scale));
          svg.style.width = `${width}px`;
          svg.style.height = `${height * scale}px`;
          svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', label ?? `Skor irama ${exercise.title}, meter ${meterLabel(exercise.meter)}`);
        }

        const allNotes: InstanceType<typeof StaveNote>[] = [];
        const noteRow: number[] = [];
        const rows: LayoutRow[] = [];
        const ts = `${exercise.meter.beats}/${exercise.meter.beatUnit}`;

        rowsIdx.forEach((rowBars, r) => {
          const y = TOP + r * ROW_H;
          const totalNeed = rowBars.reduce((a, i) => a + need[i]!, 0);
          let x = 4;
          const avail = W - 8;
          let rowStart = 0;
          let rowEnd = 0;
          rowBars.forEach((bi, k) => {
            const n = need[bi]!;
            const w = (n / totalNeed) * avail;
            const stave = new Stave(x, y, w);
            stave.setNumLines(1);
            if (bi === 0) {
              // Pusatkan tanda masa pada satu garisan
              const sig = new TimeSignature(ts);
              sig.topLine = -1;
              sig.bottomLine = 1;
              stave.addModifier(sig);
            }
            if (bi === bars.length - 1) stave.setEndBarType(3); // END barline
            stave.setContext(ctx).draw();
            const notes = bars[bi]!.map((t) => {
              const sn = new StaveNote({
                keys: ['f/5'],
                duration: durationCode(t),
                dots: t.dotted ? 1 : 0,
                stemDirection: 1,
                clef: 'percussion',
                autoStem: false,
              });
              if (t.dotted) Dot.buildAndAttach([sn], { all: true });
              return sn;
            });
            const voice = new Voice({ numBeats: exercise.meter.beats, beatValue: exercise.meter.beatUnit });
            voice.setStrict(false);
            voice.addTickables(notes);
            const beams = Beam.generateBeams(notes, { groups: [new Fraction(1, 4)], stemDirection: 1 });
            new Formatter().joinVoices([voice]).format([voice], Math.max(40, stave.getNoteEndX() - stave.getNoteStartX() - 14));
            voice.draw(ctx, stave);
            beams.forEach((b) => b.setContext(ctx).draw());
            if (k === 0) rowStart = stave.getNoteStartX();
            rowEnd = stave.getNoteEndX();
            notes.forEach((n) => {
              allNotes.push(n);
              noteRow.push(r);
            });
            x += w;
          });
          rows.push({ top: y + 8, height: ROW_H - 18, startX: rowStart, endX: rowEnd });
        });

        // Ikatan (tie) — termasuk merentas bar/baris
        const flat = bars.flat();
        flat.forEach((t, i) => {
          if (!t.tie || t.rest) return;
          const a = allNotes[i];
          const b = allNotes[i + 1];
          if (!a || !b) return;
          if (noteRow[i] === noteRow[i + 1]) {
            new StaveTie({ firstNote: a, lastNote: b, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
          } else {
            new StaveTie({ firstNote: a, lastNote: null, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
            new StaveTie({ firstNote: null, lastNote: b, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
          }
        });

        layoutRef.current = {
          events: allNotes.map((n, i) => ({ x: n.getAbsoluteX() * scale, row: noteRow[i]! })),
          rows: rows.map((rw) => ({ ...rw, top: rw.top * scale, height: rw.height * scale, startX: rw.startX * scale, endX: rw.endX * scale })),
          els: allNotes.map((n) => n.getSVGElement()),
        };
        activeRef.current = -1;
        setError(null);
        setRendered((x) => x + 1);
      })
      .catch((e: unknown) => {
        console.error(e);
        if (!cancelled) setError('Notasi tidak dapat dipaparkan.');
      });
    return () => {
      cancelled = true;
    };
  }, [exercise, width, maxBarsPerRow, scale, label]);

  // Tanda warna keputusan
  useEffect(() => {
    const els = layoutRef.current.els;
    els.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('is-hit', 'is-early', 'is-late', 'is-miss');
      const m = marks?.[i];
      if (m) el.classList.add(`is-${m}`);
    });
  }, [marks, rendered]);

  // Penunjuk main (playhead) diselaraskan dengan jam audio
  useEffect(() => {
    if (!getMusicTime) return;
    const tl = buildTimeline(exercise, bpm ?? exercise.tempoBpm);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const head = headRef.current;
      const { events, rows, els } = layoutRef.current;
      if (!head || !events.length) return;
      const t = getMusicTime();
      let idx = -1;
      if (t != null && t >= 0) {
        for (let i = 0; i < tl.length; i++) {
          if (t >= tl[i]!.time) idx = i;
          else break;
        }
        const last = tl[tl.length - 1]!;
        if (t > last.time + last.duration) idx = -1;
      }
      if (idx !== activeRef.current) {
        els[activeRef.current]?.classList.remove('is-active');
        if (idx >= 0) els[idx]?.classList.add('is-active');
        activeRef.current = idx;
      }
      if (idx < 0 || t == null) {
        head.style.opacity = '0';
        return;
      }
      const e = tl[idx]!;
      const L = events[idx]!;
      const row = rows[L.row]!;
      const next = events[idx + 1];
      const nextX = next && next.row === L.row ? next.x : row.endX;
      const frac = Math.min(1, Math.max(0, (t - e.time) / e.duration));
      const x = L.x + (nextX - L.x) * frac;
      head.style.opacity = '1';
      head.style.transform = `translate(${x}px, ${row.top}px)`;
      head.style.height = `${row.height}px`;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      layoutRef.current.els[activeRef.current]?.classList.remove('is-active');
      activeRef.current = -1;
    };
  }, [getMusicTime, exercise, bpm, rendered]);

  return (
    <div ref={wrapRef} className={`relative w-full ${light ? 'notation-light' : 'notation'} ${className}`}>
      <div ref={svgHostRef} className="min-h-[80px]" />
      {getMusicTime && (
        <div
          ref={headRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 w-[3px] -ml-[1px] rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(34,211,238,0.7)]"
          style={{ opacity: 0, willChange: 'transform' }}
        />
      )}
      {error && <p className="text-rose-300 text-sm">{error}</p>}
    </div>
  );
}
