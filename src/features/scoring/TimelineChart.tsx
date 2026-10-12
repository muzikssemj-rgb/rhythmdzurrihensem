import type { Exercise, ScoreBreakdown } from '@/types';
import { barCapacity, buildTimeline, secondsPerBeat, totalBeats } from '@/lib/rhythm';

/** Graf cap masa: sasaran vs tepukan sebenar. Bentuk + warna (tidak bergantung pada warna sahaja). */
export function TimelineChart({ exercise, bpm, result }: { exercise: Exercise; bpm: number; result: ScoreBreakdown }) {
  const tl = buildTimeline(exercise, bpm);
  const spb = secondsPerBeat(bpm);
  const beats = totalBeats(exercise);
  const dur = beats * spb;
  const pad = 0.35;
  const W = 1000;
  const H = 190;
  const x = (t: number) => 30 + ((t + pad) / (dur + 2 * pad)) * (W - 60);
  const yT = 62;
  const yC = 132;
  const bpb = barCapacity(exercise.meter);
  const targets = tl.filter((e) => e.kind === 'clap');
  const missedSet = new Set(result.missed.map((m) => m.targetIndex));
  const color = { perfect: '#4ade80', ontime: '#22d3ee', early: '#fbbf24', late: '#fb923c' } as const;

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Graf cap masa tepukan berbanding sasaran">
        {/* grid detik & bar */}
        {Array.from({ length: Math.round(beats) + 1 }, (_, b) => (
          <g key={b}>
            <line x1={x(b * spb)} x2={x(b * spb)} y1={30} y2={H - 22} stroke={b % bpb === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)'} strokeWidth={b % bpb === 0 ? 2 : 1} />
            {b % bpb === 0 && b < beats && (
              <text x={x(b * spb) + 4} y={24} fontSize={14} fill="#94a3b8" fontWeight={700}>
                Bar {b / bpb + 1}
              </text>
            )}
          </g>
        ))}
        {/* kawasan rehat */}
        {tl
          .filter((e) => e.kind === 'rest')
          .map((e) => (
            <g key={`r${e.index}`}>
              <rect x={x(e.time)} y={40} width={x(e.time + e.duration) - x(e.time)} height={110} fill="rgba(244,63,94,0.10)" />
              <text x={x(e.time) + 4} y={yT + 30} fontSize={12} fill="#fda4af">
                rehat
              </text>
            </g>
          ))}
        <text x={30} y={yT - 14} fontSize={13} fill="#cbd5e1" fontWeight={700}>
          Sasaran
        </text>
        <text x={30} y={yC + 34} fontSize={13} fill="#cbd5e1" fontWeight={700}>
          Tepukan anda
        </text>
        <line x1={20} x2={W - 20} y1={yT} y2={yT} stroke="rgba(255,255,255,0.15)" />
        <line x1={20} x2={W - 20} y1={yC} y2={yC} stroke="rgba(255,255,255,0.15)" />
        {/* garis padanan */}
        {result.hits.map((h) => (
          <line key={`m${h.targetIndex}`} x1={x(h.targetTime)} y1={yT} x2={x(h.clapTime)} y2={yC} stroke={color[h.cls]} strokeOpacity={0.5} strokeWidth={2} />
        ))}
        {/* sasaran */}
        {targets.map((t, i) => (
          <g key={`t${i}`}>
            <rect x={x(t.time) - 2} y={yT - 12} width={4} height={24} rx={2} fill={missedSet.has(i) ? '#fb7185' : '#e2e8f0'} />
            {missedSet.has(i) && (
              <text x={x(t.time)} y={yT + 30} textAnchor="middle" fontSize={12} fill="#fb7185" fontWeight={800}>
                tertinggal
              </text>
            )}
          </g>
        ))}
        {/* tepukan dipadankan */}
        {result.hits.map((h) =>
          h.cls === 'perfect' || h.cls === 'ontime' ? (
            <circle key={`h${h.clapIndex}`} cx={x(h.clapTime)} cy={yC} r={8} fill={color[h.cls]} />
          ) : (
            <path
              key={`h${h.clapIndex}`}
              d={h.cls === 'early' ? `M${x(h.clapTime) - 9} ${yC} l9 -9 l0 18 z` : `M${x(h.clapTime) + 9} ${yC} l-9 -9 l0 18 z`}
              fill={color[h.cls]}
            />
          ),
        )}
        {/* tambahan */}
        {result.extras.map((e) => (
          <g key={`e${e.clapIndex}`} stroke={e.duringRest ? '#f43f5e' : '#c084fc'} strokeWidth={3} strokeLinecap="round">
            <line x1={x(e.time) - 7} y1={yC - 7} x2={x(e.time) + 7} y2={yC + 7} />
            <line x1={x(e.time) + 7} y1={yC - 7} x2={x(e.time) - 7} y2={yC + 7} />
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300 mt-2">
        <span>
          <span className="inline-block size-2.5 rounded-full bg-emerald-400 mr-1" />Sempurna
        </span>
        <span>
          <span className="inline-block size-2.5 rounded-full bg-cyan-400 mr-1" />Tepat
        </span>
        <span className="text-amber-300">◀ Awal</span>
        <span className="text-orange-300">▶ Lewat</span>
        <span className="text-violet-300">✕ Tambahan</span>
        <span className="text-rose-400">✕ Semasa rehat</span>
        <span className="text-rose-300">▮ Tertinggal</span>
      </figcaption>
    </figure>
  );
}
