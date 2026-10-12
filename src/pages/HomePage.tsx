import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import {
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  Crown,
  Flame,
  Gauge,
  History,
  Lock,
  Music2,
  Play,
  Target,
  Trophy,
} from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { LEVELS } from '@/data/exercises';
import { LEVEL_STYLES, ProgressBar, StatTile } from '@/components/ui';
import { dailyExercise, dailyStreak, playerRank, todayKey } from '@/features/achievements/achievements';

export default function HomePage() {
  const { profile, myAttempts, exercises, config } = useApp();
  const nav = useNavigate();

  const stats = useMemo(() => {
    const n = myAttempts.length;
    const best = n ? Math.max(...myAttempts.map((a) => a.totalScore)) : 0;
    const acc = n
      ? Math.round((myAttempts.reduce((s, a) => s + (a.counts.targets ? a.counts.onTime / a.counts.targets : 0), 0) / n) * 100)
      : 0;
    return { n, best, acc, badges: Object.keys(profile.achievements).length };
  }, [myAttempts, profile.achievements]);

  const passedByLevel = useMemo(() => {
    const passed = new Set(myAttempts.filter((a) => a.stars > 0).map((a) => a.exerciseId));
    return LEVELS.map((l) => {
      const inL = exercises.filter((e) => e.level === l.id);
      return { total: inL.length, passed: inL.filter((e) => passed.has(e.id)).length };
    });
  }, [myAttempts, exercises]);

  const rank = playerRank(profile.xp);
  const daily = dailyExercise(exercises, profile.unlockedLevel);
  const doneToday = profile.dailyHistory.includes(todayKey());
  const streak = dailyStreak(profile.dailyHistory);

  const modes = [
    { to: '/latihan', title: 'Rhythm Practice', desc: 'Baca kad irama, dengar contoh dan tepuk mengikut skor.', icon: Music2, grad: 'from-cyan-400/25 to-sky-600/10', accent: 'text-cyan-300' },
    { to: '/ar', title: 'Rhythm AR Arena', desc: 'Kad irama 3D terapung di atas paparan kamera anda.', icon: Camera, grad: 'from-violet-500/25 to-fuchsia-600/10', accent: 'text-violet-300' },
    { to: '/cabaran', title: 'Rhythm Challenge', desc: 'Tiga pola berturut-turut. Kumpul markah tertinggi!', icon: Flame, grad: 'from-rose-400/25 to-orange-500/10', accent: 'text-rose-300' },
    { to: '/harian', title: 'Daily Rhythm Challenge', desc: doneToday ? 'Selesai hari ini — kembali esok!' : 'Satu pola istimewa setiap hari.', icon: Calendar, grad: 'from-teal-300/25 to-emerald-600/10', accent: 'text-teal-300' },
    { to: '/master', title: 'Rhythm Master', desc: 'Pola lanjutan dengan bantuan audio dikurangkan.', icon: Crown, grad: 'from-gold-300/25 to-gold-500/10', accent: 'text-gold-300', locked: profile.unlockedLevel < 4 },
  ];

  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] card p-6 sm:p-10">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-violet-600/30 blur-3xl" aria-hidden />
        <div className="absolute -left-16 -bottom-24 size-72 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden />
        <div className="relative grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <span className="chip text-cyan-200 mb-4">
              <Gauge size={14} /> Pendidikan Muzik • Bacaan Pola Irama
            </span>
            <h1 className="text-4xl sm:text-6xl font-bold leading-[1.05]">
              RHYTHM
              <br />
              DZURRI <span className="text-gradient">AR</span>
            </h1>
            <p className="mt-3 text-lg sm:text-xl text-slate-300 font-bold">Baca. Dengar. Tepuk. Kuasai Irama.</p>
            <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3 [&>button]:whitespace-nowrap">
              <button className="btn-primary text-lg !py-4 !px-7" onClick={() => nav('/latihan')}>
                <Play size={22} className="fill-current" /> MULA BERMAIN
              </button>
              <button className="btn-violet text-lg !py-4" onClick={() => nav('/ar')}>
                <Camera size={22} /> MOD AR
              </button>
              <button className="btn-ghost text-lg !py-4" onClick={() => nav('/profil#sejarah')}>
                <History size={22} /> LATIHAN SAYA
              </button>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* STATISTIK */}
      <section aria-labelledby="stat-h">
        <div className="flex items-end justify-between mb-3">
          <h2 id="stat-h" className="text-xl font-bold">
            Statistik {profile.displayName}
          </h2>
          <span className="text-sm text-slate-400">
            {rank.title} • {profile.xp} XP
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile icon={<CheckCircle2 size={22} />} label="Latihan selesai" value={stats.n} />
          <StatTile icon={<Trophy size={22} />} label="Markah tertinggi" value={stats.best} accent="text-gold-300" />
          <StatTile icon={<Target size={22} />} label="Ketepatan purata" value={`${stats.acc}%`} accent="text-emerald-300" />
          <StatTile icon={<Gauge size={22} />} label="Tahap semasa" value={`Tahap ${profile.unlockedLevel}`} accent="text-violet-300" />
          <StatTile icon={<Award size={22} />} label="Lencana" value={stats.badges} accent="text-rose-300" />
        </div>
      </section>

      {/* MOD */}
      <section aria-labelledby="mod-h">
        <h2 id="mod-h" className="text-xl font-bold mb-3">
          Pilih Mod Permainan
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {modes.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className={`group card p-5 bg-gradient-to-br ${m.grad} hover:-translate-y-1 hover:border-white/25 transition flex flex-col gap-3 min-h-44`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-2xl bg-ink-950/50 p-3 ${m.accent}`}>
                  <m.icon size={26} />
                </span>
                {m.locked && <Lock size={18} className="text-slate-400" aria-label="Terkunci" />}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{m.title}</h3>
                <p className="text-sm text-slate-300 mt-1">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        {daily && (
          <p className="text-sm text-slate-400 mt-3">
            Cabaran harian hari ini: <b className="text-slate-200">{daily.title}</b> (Tahap {daily.level}){streak > 0 && ` • Streak ${streak} hari 🔥`}
          </p>
        )}
      </section>

      {/* PROGRESSION */}
      <section aria-labelledby="peta-h">
        <h2 id="peta-h" className="text-xl font-bold mb-1">
          Peta Perkembangan
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Lulus {config.unlockPassCount} latihan dalam satu tahap untuk membuka tahap seterusnya. Tahap yang telah dibuka sentiasa boleh diulang.
        </p>
        <ol className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LEVELS.map((l, i) => {
            const unlocked = l.id <= profile.unlockedLevel;
            const current = l.id === profile.unlockedLevel;
            const st = LEVEL_STYLES[l.id]!;
            const p = passedByLevel[i]!;
            return (
              <li key={l.id}>
                <button
                  onClick={() => unlocked && nav(`/latihan?tahap=${l.id}`)}
                  disabled={!unlocked}
                  className={`w-full text-left card p-5 relative overflow-hidden transition ${unlocked ? 'hover:-translate-y-1' : 'opacity-60'} ${current ? `ring-2 ${st.ring}` : ''}`}
                  aria-label={`Tahap ${l.id} ${l.name} — ${unlocked ? (current ? 'tahap semasa' : 'dibuka') : 'terkunci'}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${st.grad}`} />
                  <div className="flex items-center gap-3">
                    <span className={`size-12 rounded-2xl bg-gradient-to-br ${st.grad} text-ink-950 flex items-center justify-center font-display font-bold text-xl`}>
                      {unlocked ? l.id : <Lock size={20} />}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs font-extrabold tracking-wider ${st.text}`}>TAHAP {l.id}{current && ' • SEMASA'}</div>
                      <div className="font-bold leading-tight">{l.name}</div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mt-3">
                    {l.subtitle} • {l.tempo}
                  </p>
                  <ProgressBar className="mt-3" value={p.passed} max={p.total} color={st.grad} label={`Kemajuan tahap ${l.id}`} />
                  <p className="text-xs text-slate-400 mt-1.5">
                    {p.passed}/{p.total} latihan lulus
                  </p>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function HeroVisual() {
  // Paparan dekoratif: lajur detik beranimasi (CSS sahaja — ringan)
  const bars = [1, 0.5, 0.5, 1, 2, 0.25, 0.25, 0.5, 1];
  return (
    <div className="relative h-56 sm:h-72 rounded-3xl bg-ink-950/50 border border-white/10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,211,238,0.25),transparent_60%)]" />
      <div className="absolute left-6 right-6 top-1/2 h-px bg-white/30" />
      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 flex items-end justify-between">
        {bars.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-2" style={{ animation: `float 2.4s ease-in-out ${i * 0.18}s infinite` }}>
            <span className="w-1.5 rounded-full bg-gradient-to-t from-cyan-300 to-violet-400" style={{ height: 30 + b * 18 }} />
            <span className={`rounded-full ${b >= 2 ? 'border-[3px] border-gold-300 size-5' : 'bg-gold-300 size-5'} -rotate-12`} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-3 rounded-full ${i === 0 ? 'bg-gold-300' : 'bg-cyan-300'} animate-pulse`} style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>
    </div>
  );
}
