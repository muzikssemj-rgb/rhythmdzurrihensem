import { useState, type FormEvent } from 'react';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { useApp } from '@/app/AppStore';
import { Notice } from './ui';

/** Log masuk / daftar Supabase (hanya dipaparkan jika backend dikonfigurasikan). */
export function AuthForm({ teacherHint = false }: { teacherHint?: boolean }) {
  const { cloudSignIn, cloudSignUp, toast } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'in') {
        await cloudSignIn(email.trim(), pw);
        toast('Log masuk berjaya', 'success');
      } else {
        const m = await cloudSignUp(email.trim(), pw, name.trim() || 'Murid');
        setMsg({ tone: 'success', text: m });
      }
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <div className="flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'btn-primary !min-h-10 !py-2 flex-1' : 'btn-ghost !min-h-10 !py-2 flex-1'} onClick={() => setMode('in')}>
          Log Masuk
        </button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'btn-primary !min-h-10 !py-2 flex-1' : 'btn-ghost !min-h-10 !py-2 flex-1'} onClick={() => setMode('up')}>
          Daftar
        </button>
      </div>
      {mode === 'up' && (
        <div>
          <label className="label" htmlFor="au-name">
            Nama paparan
          </label>
          <input id="au-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="nickname" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="au-email">
          E-mel
        </label>
        <input id="au-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="au-pw">
          Kata laluan
        </label>
        <input id="au-pw" className="input" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : mode === 'in' ? <LogIn size={18} /> : <UserPlus size={18} />}
        {mode === 'in' ? 'Log Masuk' : 'Cipta Akaun'}
      </button>
      {teacherHint && (
        <p className="text-xs text-slate-400">
          Akaun baharu didaftarkan sebagai murid. Pentadbir perlu menetapkan peranan <b>teacher</b> dalam pangkalan data (lihat README) — peranan tidak boleh ditukar dari aplikasi.
        </p>
      )}
    </form>
  );
}
