import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Award,
  Calendar,
  Camera,
  Crown,
  Flame,
  Lock,
  LogOut,
  Medal,
  Metronome,
  Pencil,
  Plus,
  Star,
  Target,
  Trash2,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { AVATARS, Avatar, Modal, Notice, PageHeader, ProgressBar, Stars } from '@/components/ui';
import { AuthForm } from '@/components/AuthForm';
import { ACHIEVEMENTS, playerRank, type AchievementDef } from '@/features/achievements/achievements';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import { cloudJoinClass } from '@/services/cloud';

const ICONS: Record<AchievementDef['icon'], typeof Star> = {
  star: Star,
  trophy: Trophy,
  flame: Flame,
  target: Target,
  metronome: Metronome,
  camera: Camera,
  medal: Medal,
  crown: Crown,
  zap: Zap,
  calendar: Calendar,
};

const MODE_LABEL: Record<string, string> = { practice: 'Latihan', ar: 'AR Arena', challenge: 'Cabaran', daily: 'Harian', master: 'Master' };

export default function ProfilePage() {
  const { profile, profiles, setActiveProfile, createProfile, updateProfile, deleteProfile, myAttempts, cloudUser, cloudSignOut, toast } = useApp();
  const [edit, setEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [code, setCode] = useState('');
  const [showAll, setShowAll] = useState(false);
  const loc = useLocation();
  const rank = playerRank(profile.xp);

  useEffect(() => {
    if (loc.hash === '#sejarah') document.getElementById('sejarah')?.scrollIntoView({ behavior: 'smooth' });
  }, [loc.hash]);

  const history = useMemo(() => (showAll ? myAttempts : myAttempts.slice(0, 15)), [myAttempts, showAll]);

  const openEdit = (create: boolean) => {
    setCreating(create);
    setName(create ? '' : profile.displayName);
    setAvatar(create ? AVATARS[Math.floor(Math.random() * AVATARS.length)]!.code : profile.avatar);
    setEdit(true);
  };

  const save = () => {
    const n = name.trim().slice(0, 40);
    if (!n) return;
    if (creating) {
      createProfile(n, avatar);
      toast(`Profil ${n} dicipta`, 'success');
    } else updateProfile({ displayName: n, avatar });
    setEdit(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profil & Pencapaian" backTo="/" />

      <section className="card p-6 grid md:grid-cols-[auto_1fr_auto] gap-5 items-center">
        <Avatar code={profile.avatar} size={88} />
        <div className="min-w-0">
          <h2 className="text-3xl font-bold truncate">{profile.displayName}</h2>
          <p className="text-slate-300">
            {rank.title} • Tahap {profile.unlockedLevel} dibuka • {profile.role === 'teacher' ? 'Guru' : 'Murid'}
          </p>
          <div className="mt-3 max-w-md">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{profile.xp} XP</span>
              {rank.next > rank.prev && <span>Seterusnya: {rank.next} XP</span>}
            </div>
            <ProgressBar value={profile.xp - rank.prev} max={Math.max(1, rank.next - rank.prev)} color="from-gold-300 to-violet-500" label="Kemajuan XP" />
          </div>
        </div>
        <div className="flex md:flex-col gap-2">
          <button className="btn-ghost" onClick={() => openEdit(false)}>
            <Pencil size={16} /> Ubah
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
          <Users size={20} className="text-cyan-300" /> Profil pada peranti ini
        </h2>
        <p className="text-sm text-slate-400 mb-3">Sesuai untuk tablet kelas yang dikongsi. Setiap murid mempunyai kemajuan sendiri (disimpan dalam pelayar ini).</p>
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <div key={p.id} className={`flex items-center gap-2 rounded-2xl border pl-1.5 pr-1 py-1 ${p.id === profile.id ? 'border-cyan-300/60 bg-cyan-400/10' : 'border-white/10 bg-white/5'}`}>
              <button className="flex items-center gap-2" onClick={() => setActiveProfile(p.id)} aria-pressed={p.id === profile.id}>
                <Avatar code={p.avatar} size={32} />
                <span className="font-bold text-sm pr-1">{p.displayName}</span>
              </button>
              {profiles.length > 1 && p.id !== cloudUser?.id && (
                <button
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                  aria-label={`Padam profil ${p.displayName}`}
                  onClick={() => {
                    if (window.confirm(`Padam profil "${p.displayName}" dan semua rekodnya dalam peranti ini?`)) deleteProfile(p.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button className="btn-ghost !min-h-10 !py-2" onClick={() => openEdit(true)}>
            <Plus size={16} /> Profil Baharu
          </button>
        </div>
      </section>

      {isSupabaseConfigured && (
        <section className="card p-5">
          <h2 className="font-bold text-lg mb-3">Akaun awan</h2>
          {cloudUser ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Log masuk sebagai <b>{cloudUser.email}</b> ({cloudUser.role === 'teacher' ? 'Guru' : 'Murid'}). Rekod latihan disegerakkan ke pangkalan data.
              </p>
              {cloudUser.role === 'student' && (
                <form
                  className="flex gap-2 max-w-md"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void cloudJoinClass(code)
                      .then(() => {
                        toast('Berjaya menyertai kelas', 'success');
                        setCode('');
                      })
                      .catch((err: Error) => toast(err.message, 'error'));
                  }}
                >
                  <input className="input" placeholder="Kod kelas (cth. A1B2C3)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} aria-label="Kod kelas" />
                  <button className="btn-primary !min-h-11" disabled={code.length < 4}>
                    Sertai
                  </button>
                </form>
              )}
              <button className="btn-ghost" onClick={() => void cloudSignOut()}>
                <LogOut size={16} /> Log Keluar
              </button>
            </div>
          ) : (
            <div className="max-w-md">
              <AuthForm />
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="ach-h">
        <h2 id="ach-h" className="font-bold text-xl flex items-center gap-2 mb-3">
          <Award className="text-gold-300" /> Lencana ({Object.keys(profile.achievements).length}/{ACHIEVEMENTS.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const got = profile.achievements[a.code];
            const Icon = ICONS[a.icon];
            return (
              <div key={a.code} className={`card p-4 text-center ${got ? 'border-gold-300/30' : 'opacity-55'}`}>
                <div className={`mx-auto size-12 rounded-2xl flex items-center justify-center ${got ? 'bg-gradient-to-br from-gold-300 to-gold-500 text-ink-950' : 'bg-white/5 text-slate-500'}`}>
                  {got ? <Icon size={24} /> : <Lock size={20} />}
                </div>
                <div className="font-bold text-sm mt-2">{a.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{a.description}</div>
                {got && <div className="text-[10px] text-gold-200 mt-1">{new Date(got).toLocaleDateString('ms-MY')}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section id="sejarah" aria-labelledby="hist-h" className="scroll-mt-20">
        <h2 id="hist-h" className="font-bold text-xl mb-3">
          Latihan Saya
        </h2>
        {myAttempts.length === 0 ? (
          <Notice>Belum ada latihan direkodkan. Mulakan dengan Rhythm Practice!</Notice>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="p-3">Tarikh</th>
                  <th className="p-3">Latihan</th>
                  <th className="p-3 hidden sm:table-cell">Mod</th>
                  <th className="p-3 hidden md:table-cell">Pola / Masa / Tempo</th>
                  <th className="p-3">Markah</th>
                  <th className="p-3">Bintang</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} className="border-t border-white/5">
                    <td className="p-3 whitespace-nowrap text-slate-300">{new Date(a.createdAt).toLocaleString('ms-MY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="p-3 font-bold">{a.exerciseTitle}</td>
                    <td className="p-3 hidden sm:table-cell">{MODE_LABEL[a.mode] ?? a.mode}</td>
                    <td className="p-3 hidden md:table-cell text-slate-300">
                      {a.patternScore} / {a.timingScore} / {a.stabilityScore}
                    </td>
                    <td className="p-3 font-display text-lg font-bold">{a.totalScore}</td>
                    <td className="p-3">
                      <Stars count={a.stars} size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myAttempts.length > 15 && (
              <div className="p-3 border-t border-white/5 text-center">
                <button className="btn-ghost !min-h-9 !py-1.5" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? 'Tunjuk kurang' : `Tunjuk semua (${myAttempts.length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <Modal open={edit} onClose={() => setEdit(false)} title={creating ? 'Profil Baharu' : 'Ubah Profil'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            <label className="label" htmlFor="pname">
              Nama murid
            </label>
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus />
          </div>
          <fieldset>
            <legend className="label">Pilih avatar</legend>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((a) => (
                <button
                  type="button"
                  key={a.code}
                  onClick={() => setAvatar(a.code)}
                  aria-pressed={avatar === a.code}
                  aria-label={a.label}
                  className={`rounded-2xl p-1 ${avatar === a.code ? 'ring-2 ring-cyan-300 bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <Avatar code={a.code} size={44} />
                </button>
              ))}
            </div>
          </fieldset>
          <button className="btn-primary w-full" disabled={!name.trim()}>
            Simpan
          </button>
        </form>
      </Modal>
    </div>
  );
}
