import { Camera, Hand, Headphones, Mic, Music, Smartphone, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui';
import { NOTE_NAMES_MS } from '@/lib/rhythm';
import { RhythmNotation } from '@/components/RhythmNotation';
import type { Exercise } from '@/types';

const LEGEND: Exercise = {
  id: 'legend',
  title: 'Nilai not',
  level: 1,
  meter: { beats: 4, beatUnit: 4 },
  tempoBpm: 80,
  passMark: 0,
  description: '',
  focus: '',
  bars: [
    [{ value: 'w' }],
    [{ value: 'h' }, { value: 'h', rest: true }],
    [{ value: 'q' }, { value: 'q', rest: true }, { value: '8' }, { value: '8' }, { value: '8', rest: true }, { value: '8' }],
    [{ value: '16' }, { value: '16' }, { value: '16' }, { value: '16' }, { value: 'q', dotted: true }, { value: '8' }, { value: 'q' }],
  ],
};

function Item({ icon, q, children }: { icon: ReactNode; q: string; children: ReactNode }) {
  return (
    <details className="card p-4 group">
      <summary className="font-bold cursor-pointer flex items-center gap-2 list-none">
        {icon} {q}
      </summary>
      <div className="mt-3 text-sm text-slate-300 space-y-2">{children}</div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Bantuan" subtitle="Cara bermain & penyelesaian masalah" backTo="/" />

      <section className="card p-5">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
          <Music className="text-cyan-300" /> Rujukan nilai not (meter 4/4)
        </h2>
        <div className="rounded-2xl bg-ink-950/60 p-3">
          <RhythmNotation exercise={LEGEND} maxBarsPerRow={2} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4 text-sm">
          {(['w', 'h', 'q', '8', '16'] as const).map((v) => (
            <div key={v} className="rounded-xl bg-white/5 px-3 py-2">
              <b>{NOTE_NAMES_MS[v].note}</b> — {({ w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 } as const)[v]} detik • {NOTE_NAMES_MS[v].rest} sama panjang
            </div>
          ))}
          <div className="rounded-xl bg-white/5 px-3 py-2">
            <b>Not bertitik</b> — titik menambah separuh nilai not (krocet bertitik = 1½ detik)
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2">
            <b>Ikatan (tie)</b> — dua not diikat ditepuk sekali dan ditahan
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-3">
        <Item icon={<Hand className="text-gold-300" size={18} />} q="Bagaimana cara bermain?">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Pilih latihan. Baca skor: meter, tempo dan nilai not.</li>
            <li>Tekan "Dengar Contoh" untuk mendengar pola bersama garis penunjuk.</li>
            <li>Tekan "Mula Latihan". Dengar kiraan masuk, kemudian tepuk mengikut pola.</li>
            <li>Lihat markah: Ketepatan Pola (40), Ketepatan Masa (40), Kestabilan Tempo (20).</li>
          </ol>
        </Item>
        <Item icon={<Mic className="text-cyan-300" size={18} />} q="Tepukan saya tidak dikesan / terlalu banyak dikesan">
          <ul className="list-disc pl-5 space-y-1">
            <li>Pergi ke Tetapan → Kalibrasi. Ukur bunyi latar dan tepuk 4 kali.</li>
            <li>Laraskan "Sensitiviti". Jika gema dikira dua kali, naikkan "Tempoh refraktori".</li>
            <li>Gunakan fon kepala supaya bunyi metronom tidak masuk ke mikrofon.</li>
            <li>Tutup aplikasi lain yang menggunakan mikrofon (Zoom, Meet, WhatsApp).</li>
          </ul>
        </Item>
        <Item icon={<Mic className="text-rose-300" size={18} />} q="Pelayar tidak meminta kebenaran mikrofon">
          <ul className="list-disc pl-5 space-y-1">
            <li>Mikrofon & kamera hanya berfungsi melalui HTTPS (atau localhost).</li>
            <li>Chrome/Edge: klik ikon kunci di bar alamat → Mikrofon → Benarkan, kemudian muat semula.</li>
            <li>Safari (iPhone/iPad): Tetapan → Safari → Mikrofon → Tanya/Benarkan.</li>
            <li>Android: Tetapan → Aplikasi → Chrome → Kebenaran → Mikrofon.</li>
          </ul>
        </Item>
        <Item icon={<Camera className="text-violet-300" size={18} />} q="Kamera / Mod AR tidak berfungsi">
          <ul className="list-disc pl-5 space-y-1">
            <li>Benarkan akses kamera. Jika ditolak, latihan mikrofon masih boleh diteruskan.</li>
            <li>Model pengesanan tangan dimuat turun dari Internet pada kali pertama (~8 MB).</li>
            <li>Jika kamera tiada, Arena menyediakan latar visual alternatif tanpa kamera.</li>
          </ul>
        </Item>
        <Item icon={<Headphones className="text-teal-300" size={18} />} q="Markah masa saya sentiasa 'lewat'">
          Setiap peranti mempunyai kelewatan audio. Jalankan Tetapan → Kalibrasi → <b>Kalibrasi Latensi</b> dan tepuk bersama 8 detikan. Nilai ini akan ditolak
          secara automatik.
        </Item>
        <Item icon={<Smartphone className="text-sky-300" size={18} />} q="Pasang sebagai aplikasi (PWA)">
          <ul className="list-disc pl-5 space-y-1">
            <li>Chrome/Edge (komputer & Android): menu ⋮ → "Pasang aplikasi" / "Tambah ke skrin utama".</li>
            <li>Safari iPhone/iPad: butang Kongsi → "Tambah ke Skrin Utama".</li>
          </ul>
        </Item>
        <Item icon={<Wifi className="text-amber-300" size={18} />} q="Boleh digunakan tanpa Internet?">
          Selepas lawatan pertama, latihan asas, notasi, metronom dan pengesanan tepukan boleh berfungsi luar talian pada kebanyakan pelayar moden. Pengesanan tangan
          (kali pertama), log masuk dan penyegerakan awan memerlukan Internet. Sokongan berbeza mengikut peranti.
        </Item>
        <Item icon={<Music className="text-gold-300" size={18} />} q="Tentang penilaian">
          Markah dikira secara automatik daripada cap masa tepukan berbanding skor. Kategori prestasi (Cemerlang, Sangat Baik, dll.) ialah kategori gamifikasi dan
          bukan pengganti standard pentaksiran rasmi KPM. Ketepatan bergantung pada peranti dan persekitaran.
        </Item>
      </div>
    </div>
  );
}
