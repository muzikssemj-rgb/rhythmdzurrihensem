import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Plus, Save, Square, Trash2, Volume2, X } from 'lucide-react';
import type { BeatsPerBar, Exercise, LevelId, NoteValue, RhythmToken } from '@/types';
import { BASE_BEATS, NOTE_NAMES_MS, barCapacity, parseRhythmText, rhythmToText, tokenBeats, validateExercise, TEMPO_MAX, TEMPO_MIN } from '@/lib/rhythm';
import { RhythmNotation } from '@/components/RhythmNotation';
import { Notice } from '@/components/ui';
import { useExamplePlayer } from '@/features/rhythm-practice/useExamplePlayer';
import { uid } from '@/services/localStore';

const VALUES: NoteValue[] = ['w', 'h', 'q', '8', '16'];

function tokenText(t: RhythmToken) {
  return `${t.rest ? 'R·' : ''}${NOTE_NAMES_MS[t.value][t.rest ? 'rest' : 'note'].replace('Rehat ', '')}${t.dotted ? '.' : ''}${t.tie ? '⌒' : ''}`;
}

export function blankExercise(level: LevelId = 1): Exercise {
  return {
    id: `guru-${uid().slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    title: '',
    level,
    meter: { beats: 4, beatUnit: 4 },
    tempoBpm: 80,
    bars: [[{ value: 'q' }, { value: 'q' }, { value: 'q' }, { value: 'q' }]],
    passMark: 60,
    description: '',
    focus: '',
    custom: true,
  };
}

/** Borang visual guru untuk mencipta/mengedit pola irama — dengan validasi teori muzik masa nyata. */
export function ExerciseEditor({ initial, onSave, onCancel }: { initial: Exercise; onSave: (ex: Exercise) => Promise<void>; onCancel: () => void }) {
  const [ex, setEx] = useState<Exercise>(() => structuredClone(initial));
  const [barSel, setBarSel] = useState(0);
  const [restMode, setRestMode] = useState(false);
  const [dotMode, setDotMode] = useState(false);
  const [text, setText] = useState(() => rhythmToText(initial.bars));
  const [textErr, setTextErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const player = useExamplePlayer();

  const issues = useMemo(() => validateExercise(ex), [ex]);
  const cap = barCapacity(ex.meter);
  const valid = issues.length === 0;

  const setBars = (bars: RhythmToken[][]) => {
    setEx((e) => ({ ...e, bars }));
    setText(rhythmToText(bars));
    setTextErr(null);
  };

  const addToken = (value: NoteValue) => {
    const bars = ex.bars.map((b) => [...b]);
    const tok: RhythmToken = { value };
    if (restMode) tok.rest = true;
    if (dotMode && value !== '16') tok.dotted = true;
    const used = bars[barSel]!.reduce((a, t) => a + tokenBeats(t), 0);
    if (used + tokenBeats(tok) > cap + 1e-9) {
      // bar penuh → letak dalam bar baharu jika muat
      if (tokenBeats(tok) <= cap && barSel === bars.length - 1 && bars.length < 16) {
        bars.push([tok]);
        setBarSel(bars.length - 1);
        setBars(bars);
      }
      return;
    }
    bars[barSel]!.push(tok);
    setBars(bars);
  };

  const removeToken = (b: number, i: number) => {
    const bars = ex.bars.map((x) => [...x]);
    bars[b]!.splice(i, 1);
    setBars(bars);
  };

  const toggleTie = (b: number, i: number) => {
    const bars = ex.bars.map((x) => x.map((t) => ({ ...t })));
    const t = bars[b]![i]!;
    if (t.rest) return;
    t.tie = !t.tie;
    if (!t.tie) delete t.tie;
    setBars(bars);
  };

  const meterBeats = ex.meter.beats;

  const save = async () => {
    setErr(null);
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({ ...ex, title: ex.title.trim(), focus: ex.focus.trim() || 'Pola guru', description: ex.description.trim() });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ed-title">
            Tajuk latihan
          </label>
          <input id="ed-title" className="input" value={ex.title} maxLength={80} onChange={(e) => setEx({ ...ex, title: e.target.value })} placeholder="cth. Pola Kuaver Bersama Rehat" />
        </div>
        <div>
          <label className="label" htmlFor="ed-level">
            Tahap
          </label>
          <select id="ed-level" className="input" value={ex.level} onChange={(e) => setEx({ ...ex, level: Number(e.target.value) as LevelId })}>
            <option value={1}>1 — Rookie Rhythm</option>
            <option value={2}>2 — Beat Explorer</option>
            <option value={3}>3 — Rhythm Expert</option>
            <option value={4}>4 — Rhythm Master</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ed-meter">
            Meter
          </label>
          <select id="ed-meter" className="input" value={meterBeats} onChange={(e) => setEx({ ...ex, meter: { beats: Number(e.target.value) as BeatsPerBar, beatUnit: 4 } })}>
            <option value={2}>2/4</option>
            <option value={3}>3/4</option>
            <option value={4}>4/4</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ed-tempo">
            Tempo (BPM {TEMPO_MIN}–{TEMPO_MAX})
          </label>
          <input id="ed-tempo" type="number" className="input" min={TEMPO_MIN} max={TEMPO_MAX} value={ex.tempoBpm} onChange={(e) => setEx({ ...ex, tempoBpm: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="ed-pass">
            Markah lulus (0–100)
          </label>
          <input id="ed-pass" type="number" className="input" min={0} max={100} value={ex.passMark} onChange={(e) => setEx({ ...ex, passMark: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="ed-focus">
            Fokus pembelajaran
          </label>
          <input id="ed-focus" className="input" value={ex.focus} maxLength={60} onChange={(e) => setEx({ ...ex, focus: e.target.value })} placeholder="cth. Rehat kuaver" />
        </div>
        <div>
          <label className="label" htmlFor="ed-tol">
            Toleransi masa khas (ms, pilihan)
          </label>
          <input
            id="ed-tol"
            type="number"
            className="input"
            min={40}
            max={250}
            placeholder="Guna tetapan umum"
            value={ex.scoringOverride?.toleranceMs ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? undefined : Math.max(40, Math.min(250, Number(e.target.value)));
              setEx({ ...ex, scoringOverride: v == null ? undefined : { ...ex.scoringOverride, toleranceMs: v } });
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ed-desc">
            Penerangan untuk murid
          </label>
          <textarea id="ed-desc" className="input min-h-20" value={ex.description} maxLength={300} onChange={(e) => setEx({ ...ex, description: e.target.value })} />
        </div>
        {ex.level === 4 && (
          <label className="sm:col-span-2 flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="size-5 accent-cyan-400" checked={!!ex.allowNoMetronome} onChange={(e) => setEx({ ...ex, allowNoMetronome: e.target.checked })} />
            Benarkan persembahan tanpa metronom (Rhythm Master)
          </label>
        )}
      </div>

      {/* Pembina ritma */}
      <div className="rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm mr-1">Tambah ke Bar {barSel + 1}:</span>
          {VALUES.map((v) => (
            <button
              key={v}
              type="button"
              className="btn-ghost !min-h-11 !px-3"
              onClick={() => addToken(v)}
              disabled={dotMode && v === '16'}
              title={`${restMode ? NOTE_NAMES_MS[v].rest : NOTE_NAMES_MS[v].note}${dotMode ? ' bertitik' : ''} (${tokenBeats({ value: v, dotted: dotMode && v !== '16' })} detik)`}
            >
              <span className="text-sm">{restMode ? NOTE_NAMES_MS[v].rest.replace('Rehat ', 'R. ') : NOTE_NAMES_MS[v].note}</span>
              <span className="text-xs text-cyan-300">{BASE_BEATS[v] * (dotMode && v !== '16' ? 1.5 : 1)}</span>
            </button>
          ))}
          <label className="chip cursor-pointer">
            <input type="checkbox" checked={restMode} onChange={(e) => setRestMode(e.target.checked)} className="accent-rose-400" /> Rehat
          </label>
          <label className="chip cursor-pointer">
            <input type="checkbox" checked={dotMode} onChange={(e) => setDotMode(e.target.checked)} className="accent-cyan-400" /> Bertitik
          </label>
        </div>

        <div className="space-y-2">
          {ex.bars.map((bar, b) => {
            const used = bar.reduce((a, t) => a + tokenBeats(t), 0);
            const ok = Math.abs(used - cap) < 1e-9;
            return (
              <div
                key={b}
                className={`rounded-xl border p-2 flex flex-wrap items-center gap-1.5 cursor-pointer ${b === barSel ? 'border-cyan-300/60 bg-cyan-400/5' : 'border-white/10'}`}
                onClick={() => setBarSel(b)}
              >
                <span className="text-xs font-bold w-12 shrink-0">Bar {b + 1}</span>
                {bar.map((t, i) => (
                  <span key={i} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${t.rest ? 'bg-rose-500/15 text-rose-200' : 'bg-white/10'}`}>
                    {tokenText(t)}
                    {!t.rest && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTie(b, i);
                        }}
                        className={`p-0.5 rounded ${t.tie ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-200'}`}
                        aria-label="Togol ikatan ke not seterusnya"
                        title="Ikat ke not seterusnya"
                      >
                        <Link2 size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeToken(b, i);
                      }}
                      className="p-0.5 rounded text-slate-400 hover:text-rose-300"
                      aria-label="Buang not"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <span className={`ml-auto text-xs font-bold flex items-center gap-1 ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {used}/{cap}
                </span>
                {ex.bars.length > 1 && (
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-rose-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      const bars = ex.bars.filter((_, k) => k !== b);
                      setBarSel(Math.max(0, Math.min(barSel, bars.length - 1)));
                      setBars(bars);
                    }}
                    aria-label={`Padam bar ${b + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn-ghost !min-h-10 !py-2"
          disabled={ex.bars.length >= 16}
          onClick={() => {
            setBars([...ex.bars, []]);
            setBarSel(ex.bars.length);
          }}
        >
          <Plus size={16} /> Tambah bar
        </button>

        <div>
          <label className="label" htmlFor="ed-text">
            Notasi teks (lanjutan): w h q 8 16 • r = rehat • . = titik • ~ = ikat • | = garis bar
          </label>
          <input
            id="ed-text"
            className="input font-mono text-sm"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              try {
                const bars = parseRhythmText(e.target.value);
                if (bars.length) {
                  setEx((x) => ({ ...x, bars }));
                  setBarSel((s) => Math.min(s, bars.length - 1));
                }
                setTextErr(null);
              } catch (er) {
                setTextErr((er as Error).message);
              }
            }}
          />
          {textErr && <p className="text-xs text-rose-300 mt-1">{textErr}</p>}
        </div>
      </div>

      {/* Pratonton */}
      <div className="rounded-2xl bg-ink-950/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm">Pratonton skor</span>
          <button type="button" className="btn-ghost !min-h-9 !py-1.5" disabled={!valid} onClick={() => (player.playingId ? player.stop() : void player.play(ex))}>
            {player.playingId ? <Square size={14} /> : <Volume2 size={14} />} {player.playingId ? 'Henti' : 'Dengar'}
          </button>
        </div>
        {ex.bars.every((b) => b.length > 0) ? (
          <RhythmNotation exercise={ex} getMusicTime={player.playingId ? player.getMusicTime : undefined} />
        ) : (
          <p className="text-sm text-slate-400">Tambah not pada setiap bar untuk melihat pratonton.</p>
        )}
      </div>

      {issues.length > 0 ? (
        <Notice tone="warn" icon={<AlertTriangle size={16} />}>
          <b>Pola belum sah — tidak boleh disimpan sebagai latihan aktif:</b>
          <ul className="list-disc pl-5 mt-1">
            {issues.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice tone="success" icon={<CheckCircle2 size={16} />}>
          Pola sah dari segi teori muzik: setiap bar = {cap} detik ({ex.meter.beats}/4).
        </Notice>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className="btn-primary" disabled={!valid || saving} onClick={() => void save()}>
          <Save size={18} /> Simpan Latihan
        </button>
      </div>
    </div>
  );
}
