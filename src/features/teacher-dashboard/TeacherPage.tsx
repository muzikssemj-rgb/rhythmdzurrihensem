import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, Download, FileMusic, GraduationCap, Loader2, Pencil, Plus, RefreshCw, RotateCcw, ShieldAlert, SlidersHorizontal, Trash2, Users } from 'lucide-react';
import type { AttemptRecord, Exercise, LevelId, PerformanceCategory } from '@/types';
import { useApp } from '@/app/AppStore';
import { LEVELS } from '@/data/exercises';
import { meterLabel } from '@/lib/rhythm';
import { LEVEL_STYLES, Modal, Notice, PageHeader } from '@/components/ui';
import { AuthForm } from '@/components/AuthForm';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import * as cloud from '@/services/cloud';
import { DEFAULT_CATEGORIES, DEFAULT_SCORING } from '@/features/scoring/scoringEngine';
import { ExerciseEditor, blankExercise } from './ExerciseEditor';
import { attemptsToCsv, downloadText } from './csv';

type Tab = 'latihan' | 'penilaian' | 'rekod' | 'kelas';

export default function TeacherPage() {
  const { cloudUser } = useApp();
  const [tab, setTab] = useState<Tab>('latihan');

  // Keselamatan: jika backend dikonfigurasikan, panel memerlukan akaun guru (dikuatkuasakan oleh RLS di pelayan).
  if (isSupabaseConfigured && !cloudUser) {
    return (
      <div>
        <PageHeader title="Panel Guru" subtitle="Log masuk dengan akaun guru" backTo="/" />
        <div className="card p-6 max-w-md">
          <AuthForm teacherHint />
        </div>
      </div>
    );
  }
  if (isSupabaseConfigured && cloudUser && cloudUser.role !== 'teacher') {
    return (
      <div>
        <PageHeader title="Panel Guru" backTo="/" />
        <Notice tone="error" icon={<ShieldAlert size={18} />}>
          Akaun <b>{cloudUser.email}</b> bukan akaun guru. Minta pentadbir sekolah menetapkan peranan guru untuk akaun anda.
        </Notice>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof FileMusic }[] = [
    { id: 'latihan', label: 'Latihan', icon: FileMusic },
    { id: 'penilaian', label: 'Tetapan Penilaian', icon: SlidersHorizontal },
    { id: 'rekod', label: 'Rekod & Kemajuan', icon: BarChart3 },
    ...(isSupabaseConfigured ? [{ id: 'kelas' as Tab, label: 'Kelas', icon: Users }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Panel Guru" subtitle="Urus latihan, penilaian dan rekod murid" backTo="/" right={<GraduationCap className="text-gold-300 hidden sm:block" size={32} />} />
      {!isSupabaseConfigured && (
        <Notice tone="warn" icon={<ShieldAlert size={18} />}>
          <b>Mod Demo Tempatan.</b> Backend belum dikonfigurasikan, jadi panel ini tidak dilindungi kata laluan dan semua perubahan disimpan dalam pelayar ini
          sahaja (tidak ke pangkalan data awan). Untuk log masuk guru sebenar & rekod berpusat, aktifkan Supabase (lihat README).
        </Notice>
      )}
      <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'btn-primary !min-h-11 shrink-0' : 'btn-ghost !min-h-11 shrink-0'}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'latihan' && <ExercisesTab />}
      {tab === 'penilaian' && <ScoringTab />}
      {tab === 'rekod' && <RecordsTab />}
      {tab === 'kelas' && <ClassesTab />}
    </div>
  );
}

function ExercisesTab() {
  const { exercises, saveExercise, deleteExercise, restoreBuiltins, hiddenBuiltins, toast } = useApp();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [level, setLevel] = useState<LevelId>(1);
  const list = exercises.filter((e) => e.level === level);

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const re = [...list];
    [re[idx], re[j]] = [re[j]!, re[idx]!];
    try {
      for (let k = 0; k < re.length; k++) {
        const e = re[k]!;
        if (e.order !== k * 10) await saveExercise({ ...e, order: k * 10 });
      }
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {LEVELS.map((l) => (
          <button key={l.id} onClick={() => setLevel(l.id)} className={`rounded-xl px-3 py-2 text-sm font-bold border ${level === l.id ? `bg-gradient-to-r ${LEVEL_STYLES[l.id]!.grad} text-ink-950 border-transparent` : 'border-white/10 bg-white/5'}`}>
            Tahap {l.id} ({exercises.filter((e) => e.level === l.id).length})
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {hiddenBuiltins.length > 0 && (
            <button className="btn-ghost !min-h-10 !py-2" onClick={restoreBuiltins}>
              <RotateCcw size={16} /> Pulihkan latihan asal ({hiddenBuiltins.length})
            </button>
          )}
          <button className="btn-primary !min-h-10 !py-2" onClick={() => setEditing(blankExercise(level))}>
            <Plus size={16} /> Tambah Latihan
          </button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="p-3">Susunan</th>
              <th className="p-3">Tajuk</th>
              <th className="p-3">Meter</th>
              <th className="p-3">Tempo</th>
              <th className="p-3 hidden sm:table-cell">Bar</th>
              <th className="p-3 hidden sm:table-cell">Lulus</th>
              <th className="p-3 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => (
              <tr key={e.id} className="border-t border-white/5">
                <td className="p-3 whitespace-nowrap">
                  <button className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" disabled={i === 0} onClick={() => void move(i, -1)} aria-label={`Naikkan ${e.title}`}>
                    <ArrowUp size={14} />
                  </button>
                  <button className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" disabled={i === list.length - 1} onClick={() => void move(i, 1)} aria-label={`Turunkan ${e.title}`}>
                    <ArrowDown size={14} />
                  </button>
                </td>
                <td className="p-3">
                  <div className="font-bold">{e.title}</div>
                  <div className="text-xs text-slate-400">
                    {e.id} {e.custom ? '• diubah/dicipta guru' : '• terbina dalam'}
                  </div>
                </td>
                <td className="p-3">{meterLabel(e.meter)}</td>
                <td className="p-3">{e.tempoBpm}</td>
                <td className="p-3 hidden sm:table-cell">{e.bars.length}</td>
                <td className="p-3 hidden sm:table-cell">{e.passMark}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button className="btn-ghost !min-h-9 !px-2.5 !py-1" onClick={() => setEditing(structuredClone(e))} aria-label={`Edit ${e.title}`}>
                    <Pencil size={14} />
                  </button>{' '}
                  <button
                    className="btn-danger !min-h-9 !px-2.5 !py-1"
                    onClick={() => {
                      if (window.confirm(`Padam latihan "${e.title}"?${e.custom ? '' : ' (Latihan terbina dalam boleh dipulihkan kemudian.)'}`))
                        void deleteExercise(e.id)
                          .then(() => toast('Latihan dipadam', 'success'))
                          .catch((er: Error) => toast(er.message, 'error'));
                    }}
                    aria-label={`Padam ${e.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-4 text-slate-400">Tiada latihan dalam tahap ini.</p>}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && exercises.some((x) => x.id === editing.id) ? 'Edit Latihan' : 'Latihan Baharu'} wide>
        {editing && (
          <ExerciseEditor
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={async (ex) => {
              await saveExercise(ex);
              toast(`"${ex.title}" disimpan`, 'success');
              setLevel(ex.level);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function NumField({ id, label, value, min, max, step = 1, onChange, hint }: { id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} type="number" className="input" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))} />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ScoringTab() {
  const { config, updateConfig, resetConfig, toast } = useApp();
  const s = config.scoring;
  const total = s.weights.pattern + s.weights.timing + s.weights.stability;
  const setScoring = (patch: Partial<typeof s>) => updateConfig({ scoring: { ...s, ...patch } });
  const setCats = (cats: PerformanceCategory[]) => updateConfig({ categories: cats });

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="card p-5 space-y-4">
        <h3 className="font-bold text-lg">Pemberat markah</h3>
        <div className="grid grid-cols-3 gap-3">
          <NumField id="w-p" label="Pola" value={s.weights.pattern} min={0} max={100} onChange={(v) => setScoring({ weights: { ...s.weights, pattern: v } })} />
          <NumField id="w-t" label="Masa" value={s.weights.timing} min={0} max={100} onChange={(v) => setScoring({ weights: { ...s.weights, timing: v } })} />
          <NumField id="w-s" label="Kestabilan" value={s.weights.stability} min={0} max={100} onChange={(v) => setScoring({ weights: { ...s.weights, stability: v } })} />
        </div>
        <p className={`text-sm ${total === 100 ? 'text-emerald-300' : 'text-amber-300'}`}>Jumlah pemberat: {total} {total !== 100 && '(markah akhir dinormalkan kepada 100)'}</p>
        <h3 className="font-bold text-lg pt-2">Toleransi masa</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField id="tol" label="Toleransi tepat (ms)" value={s.toleranceMs} min={40} max={250} onChange={(v) => setScoring({ toleranceMs: v })} hint="Lalai 120 ms" />
          <NumField id="perf" label="Sempurna (ms)" value={s.perfectMs} min={10} max={s.toleranceMs} onChange={(v) => setScoring({ perfectMs: v })} hint="Kredit masa penuh" />
          <NumField id="maxw" label="Tetingkap maksimum (ms)" value={s.maxWindowMs} min={s.toleranceMs} max={400} onChange={(v) => setScoring({ maxWindowMs: v })} hint="Di luar ini = tepukan tambahan" />
          <NumField id="xp" label="Penalti tambahan" value={s.extraPenalty} min={0} max={1} step={0.05} onChange={(v) => setScoring({ extraPenalty: v })} hint="Pecahan satu not" />
          <NumField id="rp" label="Penalti semasa rehat" value={s.restPenalty} min={0} max={1.5} step={0.05} onChange={(v) => setScoring({ restPenalty: v })} />
        </div>
      </section>
      <section className="card p-5 space-y-4">
        <h3 className="font-bold text-lg">Perkembangan tahap</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField id="unl" label="Latihan lulus untuk buka tahap" value={config.unlockPassCount} min={1} max={10} onChange={(v) => updateConfig({ unlockPassCount: v })} />
          <div>
            <label className="label" htmlFor="cib">
              Kiraan masuk
            </label>
            <select id="cib" className="input" value={config.countInBars} onChange={(e) => updateConfig({ countInBars: Number(e.target.value) as 1 | 2 })}>
              <option value={1}>1 bar</option>
              <option value={2}>2 bar</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-5 accent-cyan-400" checked={config.masterNoMetronome} onChange={(e) => updateConfig({ masterNoMetronome: e.target.checked })} />
          Aktifkan cabaran tanpa metronom (Tahap 4 / Rhythm Master)
        </label>
        <h3 className="font-bold text-lg pt-2">Kategori prestasi (gamifikasi)</h3>
        <div className="space-y-2">
          {config.categories.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="number"
                className="input !w-24"
                min={0}
                max={100}
                value={c.min}
                aria-label={`Markah minimum kategori ${i + 1}`}
                onChange={(e) => setCats(config.categories.map((x, k) => (k === i ? { ...x, min: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))}
              />
              <input className="input" value={c.label} maxLength={40} aria-label={`Label kategori ${i + 1}`} onChange={(e) => setCats(config.categories.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">Kategori ini ialah kategori gamifikasi, bukan pengganti standard pentaksiran rasmi KPM.</p>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={() => {
              resetConfig();
              toast('Tetapan penilaian dikembalikan kepada lalai');
            }}
          >
            <RotateCcw size={16} /> Lalai
          </button>
          <button className="btn-ghost" onClick={() => setScoring({ ...DEFAULT_SCORING })}>
            Pemberat lalai (40/40/20)
          </button>
          <button className="btn-ghost" onClick={() => setCats(DEFAULT_CATEGORIES)}>
            Kategori lalai
          </button>
        </div>
        {isSupabaseConfigured && <p className="text-xs text-slate-400">Nota: tetapan penilaian umum disimpan pada peranti ini. Toleransi khas setiap latihan disimpan bersama latihan di pangkalan data.</p>}
      </section>
    </div>
  );
}

function RecordsTab() {
  const { attempts, backend } = useApp();
  const [cloudRows, setCloudRows] = useState<AttemptRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [student, setStudent] = useState('');
  const [exId, setExId] = useState('');

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      setCloudRows(await cloud.cloudFetchAttempts());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (backend === 'supabase') void load();
  }, [backend]);

  const rows = backend === 'supabase' && cloudRows ? cloudRows : attempts;
  const filtered = rows.filter((r) => (!student || r.profileId === student) && (!exId || r.exerciseId === exId));
  const students = useMemo(() => [...new Map(rows.map((r) => [r.profileId, r.profileName])).entries()], [rows]);
  const exs = useMemo(() => [...new Map(rows.map((r) => [r.exerciseId, r.exerciseTitle])).entries()], [rows]);

  const summary = useMemo(() => {
    const m = new Map<string, { name: string; n: number; sum: number; best: number; lvl: number; passed: Set<string> }>();
    for (const r of rows) {
      const s = m.get(r.profileId) ?? { name: r.profileName, n: 0, sum: 0, best: 0, lvl: 1, passed: new Set<string>() };
      s.n++;
      s.sum += r.totalScore;
      s.best = Math.max(s.best, r.totalScore);
      s.lvl = Math.max(s.lvl, r.level);
      if (r.stars > 0) s.passed.add(r.exerciseId);
      m.set(r.profileId, s);
    }
    return [...m.entries()];
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="label" htmlFor="f-st">
            Murid
          </label>
          <select id="f-st" className="input" value={student} onChange={(e) => setStudent(e.target.value)}>
            <option value="">Semua</option>
            {students.map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-ex">
            Latihan
          </label>
          <select id="f-ex" className="input" value={exId} onChange={(e) => setExId(e.target.value)}>
            <option value="">Semua</option>
            {exs.map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          {backend === 'supabase' && (
            <button className="btn-ghost" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Muat semula
            </button>
          )}
          <button className="btn-primary" disabled={!filtered.length} onClick={() => downloadText(`rekod-rhythm-master-${new Date().toISOString().slice(0, 10)}.csv`, attemptsToCsv(filtered))}>
            <Download size={16} /> Eksport CSV
          </button>
        </div>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      <p className="text-xs text-slate-400">
        {backend === 'supabase' ? 'Rekod murid dalam kelas anda (dikawal oleh Row Level Security).' : 'Mod Tempatan: rekod semua profil murid pada peranti ini sahaja.'}
      </p>

      <section className="card overflow-x-auto">
        <h3 className="font-bold p-4 pb-0">Kemajuan murid</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="p-3">Murid</th>
              <th className="p-3">Percubaan</th>
              <th className="p-3">Purata</th>
              <th className="p-3">Terbaik</th>
              <th className="p-3">Latihan lulus</th>
              <th className="p-3">Tahap tertinggi dicuba</th>
            </tr>
          </thead>
          <tbody>
            {summary.map(([id, s]) => (
              <tr key={id} className="border-t border-white/5">
                <td className="p-3 font-bold">{s.name}</td>
                <td className="p-3">{s.n}</td>
                <td className="p-3">{Math.round(s.sum / s.n)}</td>
                <td className="p-3">{s.best}</td>
                <td className="p-3">{s.passed.size}</td>
                <td className="p-3">{s.lvl}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.length === 0 && <p className="p-4 text-slate-400">Belum ada rekod.</p>}
      </section>

      <section className="card overflow-x-auto">
        <h3 className="font-bold p-4 pb-0">Rekod latihan ({filtered.length})</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="p-3">Tarikh</th>
              <th className="p-3">Murid</th>
              <th className="p-3">Latihan</th>
              <th className="p-3 hidden md:table-cell">Pola/Masa/Tempo</th>
              <th className="p-3">Jumlah</th>
              <th className="p-3 hidden sm:table-cell">Tertinggal/Tambahan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 whitespace-nowrap text-slate-300">{new Date(r.createdAt).toLocaleString('ms-MY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="p-3">{r.profileName}</td>
                <td className="p-3">{r.exerciseTitle}</td>
                <td className="p-3 hidden md:table-cell">
                  {r.patternScore}/{r.timingScore}/{r.stabilityScore}
                </td>
                <td className="p-3 font-bold">{r.totalScore}</td>
                <td className="p-3 hidden sm:table-cell">
                  {r.counts?.missed ?? 0}/{(r.counts?.extra ?? 0) + (r.counts?.restViolations ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ClassesTab() {
  const { cloudUser, toast } = useApp();
  const [classes, setClasses] = useState<cloud.ClassInfo[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    cloud
      .cloudFetchClasses()
      .then(setClasses)
      .catch((e: Error) => toast(e.message, 'error'));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-4 max-w-2xl">
      <form
        className="card p-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!cloudUser) return;
          setBusy(true);
          void cloud
            .cloudCreateClass(cloudUser.id, name.trim())
            .then(() => {
              setName('');
              toast('Kelas dicipta', 'success');
              return load();
            })
            .catch((er: Error) => toast(er.message, 'error'))
            .finally(() => setBusy(false));
        }}
      >
        <input className="input" placeholder="Nama kelas (cth. 4 Bestari)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required aria-label="Nama kelas" />
        <button className="btn-primary" disabled={busy || !name.trim()}>
          <Plus size={16} /> Cipta
        </button>
      </form>
      <div className="card divide-y divide-white/5">
        {classes.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between">
            <span className="font-bold">{c.name}</span>
            <span className="chip text-base font-mono text-gold-200">Kod: {c.joinCode}</span>
          </div>
        ))}
        {classes.length === 0 && <p className="p-4 text-slate-400">Belum ada kelas. Murid menyertai kelas menggunakan kod di halaman Profil.</p>}
      </div>
    </div>
  );
}
