import type { Exercise, ScoreBreakdown } from '@/types';
import { beatLabel } from '@/lib/rhythm';

export interface FeedbackItem {
  tone: 'good' | 'tip' | 'warn';
  text: string;
}

const place = (bar: number, beat: number) => `bar ${bar + 1}, ${beatLabel(beat)}`;

/** Maklum balas pedagogi dalam Bahasa Melayu berdasarkan analisis sebenar. */
export function generateFeedback(r: ScoreBreakdown, ex: Exercise): FeedbackItem[] {
  const out: FeedbackItem[] = [];
  const c = r.counts;

  if (c.hits === 0 && c.extra + c.restViolations === 0) {
    out.push({ tone: 'warn', text: 'Tiada tepukan dikesan. Semak mikrofon, dekatkan peranti, atau jalankan kalibrasi semula di Tetapan.' });
    return out;
  }

  if (r.total >= 90) out.push({ tone: 'good', text: 'Cemerlang! Pola, masa dan tempo anda sangat tepat.' });
  else if (r.total >= ex.passMark) out.push({ tone: 'good', text: `Tahniah, anda lulus latihan "${ex.title}"!` });

  const stable = r.tempo.sufficientData && r.tempo.trend === 'stabil' && r.tempo.jitterMs < 45;
  if (stable && c.late > 0) out.push({ tone: 'tip', text: `Tempo anda stabil, tetapi terdapat ${c.late} tepukan yang lewat.` });
  else if (stable && c.early > 0) out.push({ tone: 'tip', text: `Tempo anda stabil, tetapi terdapat ${c.early} tepukan yang terlalu awal.` });
  else if (stable) out.push({ tone: 'good', text: 'Tempo anda stabil sepanjang latihan.' });

  if (r.tempo.trend === 'melaju')
    out.push({ tone: 'tip', text: `Anda cenderung mempercepatkan tempo (anggaran ${Math.round(r.tempo.estimatedBpm)} BPM berbanding ${ex.tempoBpm} BPM). Dengar detikan metronom dan jangan tergesa-gesa.` });
  if (r.tempo.trend === 'melambat')
    out.push({ tone: 'tip', text: `Tempo anda semakin perlahan (anggaran ${Math.round(r.tempo.estimatedBpm)} BPM berbanding ${ex.tempoBpm} BPM). Kekalkan nadi yang sekata.` });
  if (r.tempo.sufficientData && r.tempo.jitterMs >= 45)
    out.push({ tone: 'tip', text: 'Jarak antara tepukan kurang sekata. Cuba kira detik dengan kuat ("1-dan-2-dan").' });

  if (c.restViolations > 0)
    out.push({ tone: 'warn', text: `Anda ${c.hits >= c.targets * 0.8 ? 'berjaya mengikuti pola tetapi ' : ''}masih perlu memberi perhatian kepada tanda rehat — ${c.restViolations} tepukan berlaku semasa rehat.` });

  if (c.missed > 0) {
    const where = r.missed.slice(0, 3).map((m) => place(m.bar, m.beatInBar)).join('; ');
    out.push({ tone: 'warn', text: `${c.missed} tepukan tertinggal (${where}${r.missed.length > 3 ? ', …' : ''}).` });
  }
  if (c.extra > 0) out.push({ tone: 'warn', text: `${c.extra} tepukan tambahan dikesan di luar pola. Tepuk hanya pada not.` });

  if (Math.abs(r.tempo.meanOffsetMs) > 70 && r.tempo.sufficientData && stable)
    out.push({
      tone: 'tip',
      text: `Secara purata tepukan anda ${Math.round(Math.abs(r.tempo.meanOffsetMs))} ms ${r.tempo.meanOffsetMs > 0 ? 'lewat' : 'awal'}. Jika ini berlaku setiap kali, jalankan "Kalibrasi Latensi" di Tetapan.`,
    });

  if (r.total < ex.passMark) {
    out.push({ tone: 'tip', text: 'Cuba dengar contoh dan metronom sekali lagi sebelum memulakan latihan.' });
    if (ex.tempoBpm > 60) out.push({ tone: 'tip', text: `Berlatih dahulu pada tempo lebih perlahan (cth. ${Math.max(40, ex.tempoBpm - 15)} BPM), kemudian naikkan semula.` });
  }
  return out;
}

export function suggestNext(total: number, ex: Exercise): string {
  if (total >= 90) return 'Cuba latihan seterusnya atau Rhythm Challenge.';
  if (total >= ex.passMark) return 'Ulang sekali lagi untuk mendapat 3 bintang.';
  return `Latih semula "${ex.title}" pada tempo lebih perlahan.`;
}
