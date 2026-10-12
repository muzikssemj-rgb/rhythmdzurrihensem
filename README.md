# RHYTHM MASTER AR

**Baca. Dengar. Tepuk. Kuasai Irama.**

Aplikasi web gamifikasi Pendidikan Muzik untuk melatih bacaan pola irama. Murid membaca kad irama (notasi sebenar), mendengar contoh dan metronom, kemudian **menepuk tangan**. Mikrofon peranti mengesan setiap tepukan, dan enjin penilaian memberi markah bagi ketepatan pola, ketepatan masa dan kestabilan tempo. Kamera (MediaPipe) mengesan pergerakan tangan, dan **Rhythm AR Arena** memaparkan kad irama serta kesan 3D di atas paparan kamera.

> Bahasa utama: Bahasa Melayu. Istilah muzik standard (Tempo, Beat, BPM, Rest, AR) dikekalkan.

---

## Kandungan

1. [Ciri-ciri](#ciri-ciri)
2. [Teknologi](#teknologi)
3. [Keperluan](#keperluan)
4. [Pemasangan & menjalankan secara lokal](#pemasangan--menjalankan-secara-lokal)
5. [Ujian](#ujian)
6. [Struktur projek](#struktur-projek)
7. [Cara pengesanan tepukan & pemarkahan berfungsi](#cara-pengesanan-tepukan--pemarkahan-berfungsi)
8. [Menyediakan Supabase (pilihan)](#menyediakan-supabase-pilihan)
9. [Deploy ke GitHub & Vercel](#deploy-ke-github--vercel)
10. [Pemboleh ubah persekitaran](#pemboleh-ubah-persekitaran)
11. [Penyelesaian masalah mikrofon & kamera](#penyelesaian-masalah-mikrofon--kamera)
12. [Batasan yang diketahui](#batasan-yang-diketahui)

---

## Ciri-ciri

| Modul | Penerangan |
|---|---|
| **Rhythm Practice** | 24 latihan terbina dalam (6 setiap tahap) yang disahkan dari segi teori muzik. Notasi sebenar (VexFlow, fon Bravura). Dengar Contoh, Mula, Jeda/Sambung, Ulang, Keluar. Tempo boleh diperlahankan untuk latihan. |
| **Metronom** | Web Audio API; detikan dijadualkan pada `AudioContext.currentTime` (bukan `setInterval`). Aksen detik pertama, kiraan masuk 1–2 bar, penunjuk detik & garis penunjuk skor diselaraskan dengan jam audio. Metronom bebas 40–180 BPM di Tetapan. |
| **Pengesanan tepukan** | AudioWorklet (sandaran ScriptProcessor) → penapis high-pass 4-tertib 2.5 kHz → pengesan onset dengan aras hingar adaptif, ambang dinamik, syarat kenaikan, pintu gema, tempoh refraktori & histeresis. Kalibrasi 3 langkah (hingar latar, tepuk 4 kali, latensi). Audio **tidak dirakam/dimuat naik**. |
| **Enjin penilaian** | Padanan satu-ke-satu optimum (DP), kelas tepat/awal/lewat/tertinggal/tambahan/semasa rehat, analisis tempo (regresi: hanyut & jitter). Pola 40 + Masa 40 + Kestabilan 20 (boleh dikonfigurasi). |
| **Keputusan** | Markah besar, bintang, kategori, komponen, kiraan, skor berwarna, graf cap masa, analisis tempo, maklum balas BM, lencana, animasi 3D ganjaran. |
| **Kamera & tangan** | MediaPipe Hand Landmarker (2 tangan), overlay titik sendi, pengesanan gerakan tepuk sebagai *pengesahan tambahan* (tidak mengubah markah). Kegagalan kamera tidak menjejaskan latihan mikrofon. |
| **Rhythm AR Arena** | Video kamera langsung + kad irama 3D terapung (CSS 3D) + lapisan Three.js/React Three Fiber (trek detik 3D, letupan bintang mengikut ketepatan, not terapung). Kad boleh diskalakan (S/M/L); kamera boleh dihenti/tukar; mod visual alternatif tanpa kamera. |
| **Tahap & pencapaian** | 4 tahap (Rookie Rhythm → Rhythm Master), kunci tahap, bintang, rekod peribadi, kombo, XP & pangkat, 14 lencana, cabaran harian (streak), Rhythm Challenge (3 pola), mod Rhythm Master (tanpa contoh audio / tanpa metronom pilihan guru). Tahap yang dibuka tidak dikunci semula. |
| **Panel Guru** | Pembina pola visual dengan validasi masa nyata, tambah/edit/padam/susun latihan, tempo, meter, markah lulus, toleransi khas, pemberat markah, toleransi umum, kategori prestasi, syarat buka tahap, rekod & kemajuan murid, **eksport CSV**, kelas (Supabase). |
| **Storan** | Mod Tempatan (localStorage, berbilang profil murid pada satu peranti) atau Supabase (Auth + RLS + RPC). |
| **PWA** | Manifest, ikon, service worker (Workbox), halaman luar talian, gesaan kemas kini. Data Supabase tidak dicache. |
| **Aksesibiliti** | Kawalan papan kekunci (P jeda, Esc henti, Ruang tepuk dalam demo), label ARIA, kontras tinggi, butang besar, "Kurangkan animasi", petunjuk bentuk + warna pada graf. |

### Mod Demo (Simulasi)
Jika mikrofon tidak tersedia/ditolak, murid boleh memilih **Mod Demo**: tepuk melalui butang/kekunci Ruang atau tonton demo automatik. Ia dilabel jelas **SIMULASI** dan **tidak direkodkan** sebagai penilaian.

---

## Teknologi

React 19 · TypeScript 5.9 (strict) · Vite 8 · Tailwind CSS 4 · Lucide React · Web Audio API (AudioWorklet) · VexFlow 5 · MediaPipe Tasks Vision · Three.js + React Three Fiber · vite-plugin-pwa (Workbox) · Supabase JS v2 · Vitest · React Router 7

## Keperluan

- **Node.js 20.19+ atau 22.12+** (diuji dengan Node 22.22) dan npm 10+
- Pelayar moden: Chrome/Edge 100+, Safari 15+ (iOS/iPadOS/macOS), Firefox 110+
- Mikrofon dan kamera memerlukan **HTTPS** (atau `http://localhost` semasa pembangunan)

## Pemasangan & menjalankan secara lokal

```bash
npm install
npm run dev          # http://localhost:5173
```

Bina versi produksi dan pratonton:

```bash
npm run build        # tsc -b && vite build → dist/
npm run preview      # http://localhost:4173
```

> Untuk menguji pada telefon dalam rangkaian yang sama, mikrofon/kamera memerlukan HTTPS. Cara paling mudah: deploy ke Vercel (lihat bawah), atau gunakan terowong HTTPS seperti `npx localtunnel` / Cloudflare Tunnel.

## Ujian

```bash
npm test             # Vitest (ujian unit)
npm run typecheck    # TypeScript tanpa output
```

Ujian unit yang disediakan (52 ujian dalam 5 fail):

- `src/features/scoring/scoringEngine.test.ts` — tepukan sempurna, awal, lewat, tertinggal, tambahan, tepukan semasa rehat, rehat dipatuhi, semikuaver pada 110 BPM, not bertitik, not diikat, anjakan latensi malar, hanyut tempo, kiraan masuk diabaikan, pengawal liputan, pengawal tepuk rambang, pemberat, kategori & bintang.
- `src/lib/rhythm.test.ts` — ≥ 20 latihan sah, ≥ 5 setiap tahap, jumlah durasi bar = meter, julat tempo, ID unik, penolakan pola tidak sah, garis masa.
- `src/features/audio-engine/clapDetection.test.ts` — isyarat sintetik: tepukan kuat/perlahan/campuran, gema, tepukan pantas (semikuaver), hingar berterusan, bocoran metronom (sinus), dengung frekuensi rendah, persekitaran bising, refraktori boleh laras, kalibrasi ambang & latensi.
- `src/features/hand-tracking/clapGesture.test.ts` — gerakan tepuk daripada titik sendi tangan.
- `src/features/teacher-dashboard/csv.test.ts` — eksport CSV.

> Ujian pengesanan tepukan menggunakan isyarat **sintetik**. Ketepatan sebenar bergantung pada mikrofon, bilik dan peranti; ujian pada peranti sebenar masih diperlukan (lihat [Batasan](#batasan-yang-diketahui)).

## Struktur projek

```
src/
  app/                 App.tsx (laluan), AppStore.tsx (keadaan global & storan)
  components/          UI dikongsi: RhythmNotation (VexFlow), ui.tsx, Reward3D, AuthForm, PwaPrompt …
  layouts/             AppLayout (header, nav bawah telefon, toast)
  pages/               Home, PracticeHub, Practice, Results, Challenge, Daily, Master, Profile, Settings, Help …
  features/
    audio-engine/      clapDetectionEngine.ts, audioCalibration.ts, micClapInput.ts, useClapDetection.ts,
                       MicProvider.tsx, metronome.ts, synth.ts, CalibrationWizard, MicPanel, MetronomeTool
    rhythm-practice/   sessionEngine.ts, usePracticeSession.ts, PracticeStage, SessionWidgets, ExerciseCard
    scoring/           scoringEngine.ts, feedback.ts, ResultsView, TimelineChart
    hand-tracking/     handTracker.ts, clapGesture.ts, useCamera.ts, useHandTracking.ts, CameraPanel
    ar-arena/          ArenaPage.tsx, ArScene.tsx (React Three Fiber)
    achievements/      achievements.ts (lencana, tahap, streak, cabaran harian)
    teacher-dashboard/ TeacherPage, ExerciseEditor, csv.ts
  data/exercises.ts    24 latihan terbina dalam (disahkan)
  lib/rhythm.ts        nilai not, validasi teori muzik, garis masa
  services/            localStore.ts, supabaseClient.ts, cloud.ts
  types/               jenis TypeScript
  styles/index.css     tema Tailwind 4
supabase/migrations/   skema SQL + RLS + RPC
public/                ikon PWA, offline.html
```

## Cara pengesanan tepukan & pemarkahan berfungsi

**Jam muzik.** Semua detikan metronom dijadualkan terlebih dahulu pada `AudioContext.currentTime`. Masa sasaran setiap not = `kedudukan_detik × 60 / BPM`, dikira daripada durasi sebenar setiap not (kuaver ½, semikuaver ¼, not bertitik ×1.5, ikatan tidak ditepuk semula). Animasi membaca jam audio dalam `requestAnimationFrame`; frame rate tidak digunakan sebagai jam. Jeda menggunakan `AudioContext.suspend()` supaya jadual kekal tepat.

**Onset tepukan.** AudioWorklet mengira tenaga jalur tinggi (> 2.5 kHz) bagi setiap blok 128 sampel (~2.7 ms) dan mencatat masa blok pada jam audio yang sama. Detikan metronom ialah sinus 660/880 Hz, jadi bocorannya ditapis. Onset dikira apabila tenaga melepasi `max(ambang kalibrasi, hingar + margin)`, melonjak ≥ 9 dB berbanding ~20 ms sebelumnya, melepasi pintu gema yang mereput daripada puncak sebelumnya, dan berada di luar tempoh refraktori (lalai 70 ms, boleh laras).

**Padanan & markah.** Dynamic programming mencari padanan satu-ke-satu yang mengekalkan susunan masa (kos: tertinggal = 1, tambahan = 1, padanan = |Δt|/tetingkap × 0.9). Tepukan semasa kiraan masuk diabaikan.

- **Pola (40):** `(dipadankan − 0.5×tambahan − 0.75×semasa_rehat) / bil_not`
- **Masa (40):** purata kredit masa bagi tepukan yang dipadankan sahaja (≤ 45 ms = penuh, ≤ 120 ms = tepat, menurun hingga tetingkap 250 ms). Tepukan tertinggal tidak dihukum dua kali di sini.
- **Kestabilan (20):** regresi linear masa sebenar vs sasaran → hanyut tempo (kecerunan ≠ 1) dan jitter baki. Anjakan malar (cth. latensi peranti) tidak dikira sebagai tidak stabil.
- Pengawal: jika < 50% not dimainkan atau < 80% tepukan sah (tepuk rambang), markah masa & kestabilan diskalakan supaya ia tidak boleh "dimain-mainkan".

Semua pemberat, toleransi dan penalti boleh diubah di **Panel Guru → Tetapan Penilaian**.

## Menyediakan Supabase (pilihan)

Tanpa Supabase, aplikasi berjalan dalam **Mod Tempatan**: semua data dalam pelayar (label "Mod Tempatan" dipaparkan) dan Panel Guru tidak dilindungi kata laluan (dilabel sebagai mod demo).

1. Cipta projek di <https://supabase.com>.
2. **SQL Editor** → tampal & jalankan `supabase/migrations/20261012000000_init.sql` (atau `supabase db push` jika menggunakan Supabase CLI). Skrip ini idempoten.
3. **Authentication → Providers → Email**: aktifkan. (Pilihan: matikan "Confirm email" untuk ujian kelas.)
4. **Project Settings → API**: salin **Project URL** dan kunci **anon / publishable**.
5. Cipta `.env.local`:
   ```bash
   cp .env.example .env.local
   # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
   ```
6. Daftar akaun guru melalui aplikasi (Profil → Daftar). Semua akaun baharu ialah **murid**. Tetapkan peranan guru dalam SQL Editor:
   ```sql
   update public.profiles set role = 'teacher'
   where id = (select id from auth.users where email = 'guru@sekolah.edu.my');
   ```
7. Guru: Panel Guru → **Kelas** → cipta kelas → beri **kod kelas** kepada murid. Murid: Profil → masukkan kod → Sertai.

**Keselamatan (dikuatkuasakan di pelayan):**
- RLS pada semua jadual. Murid hanya melihat rekod sendiri; guru hanya melihat murid dalam kelasnya.
- Murid **tidak boleh** `insert/update/delete` terus pada `practice_attempts`; rekod hanya melalui RPC `submit_attempt` (validasi julat, had kadar 3 saat).
- Pengguna hanya boleh mengubah `display_name` & `avatar` (bukan `role`).
- `rhythm_exercises` mempunyai kekangan `validate_rhythm()` — pola yang jumlah durasi bar tidak sepadan dengan meter ditolak oleh pangkalan data.
- Hanya kunci **anon** di frontend. **Jangan** letak `service_role` key dalam mana-mana pemboleh ubah `VITE_*`.

Skema ini telah diuji pada PostgreSQL 16 dengan skema `auth` tiruan (pendaftaran → profil murid, percubaan menaikkan peranan ditolak, insert/update terus ditolak, had kadar, pola tidak sah ditolak, keterlihatan guru ↔ kelas).

## Deploy ke GitHub & Vercel

### 1. Git & GitHub

```bash
git init
git add .
git commit -m "Initial Rhythm Master AR application"
git branch -M main
# Cipta repositori kosong di https://github.com/new (cth. rhythm-master-ar), kemudian:
git remote add origin https://github.com/<nama-pengguna>/rhythm-master-ar.git
git push -u origin main
```

### 2. Vercel

1. Log masuk <https://vercel.com> → **Add New… → Project** → **Import** repositori GitHub tadi.
2. **Framework Preset:** `Vite`
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. **Install Command:** `npm install` (lalai)
6. **Environment Variables** (pilihan, untuk Supabase): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — untuk Production & Preview.
7. Klik **Deploy**.
8. Buka domain `https://<projek>.vercel.app` — HTTPS disediakan automatik.
9. Uji: muat semula pada `/latihan` atau `/guru` (tidak sepatutnya 404 — `vercel.json` mengandungi rewrite SPA).
10. Uji pada telefon/tablet: benarkan mikrofon → Tetapan → Kalibrasi; kemudian Mod AR → benarkan kamera.

`vercel.json` turut menetapkan `Permissions-Policy: camera=(self), microphone=(self)` dan `Cache-Control: no-cache` untuk `sw.js`.

Jika menggunakan Supabase, tambah domain Vercel anda dalam **Supabase → Authentication → URL Configuration → Site URL / Redirect URLs**.

## Pemboleh ubah persekitaran

| Nama | Wajib? | Penerangan |
|---|---|---|
| `VITE_SUPABASE_URL` | Tidak | URL projek Supabase. Kosong = Mod Tempatan. |
| `VITE_SUPABASE_ANON_KEY` | Tidak | Kunci anon/publishable Supabase (selamat untuk frontend dengan RLS). |

Tiada rahsia lain diperlukan. Fail `.env*` (kecuali `.env.example`) diabaikan oleh Git.

## Penyelesaian masalah mikrofon & kamera

| Masalah | Penyelesaian |
|---|---|
| Tiada gesaan kebenaran | Pastikan URL bermula dengan `https://` (atau `localhost`). |
| Kebenaran pernah ditolak | Chrome/Edge: ikon kunci di bar alamat → Mikrofon/Kamera → Benarkan → muat semula. Safari iOS: Tetapan → Safari → Mikrofon/Kamera. Android: Tetapan → Aplikasi → Chrome → Kebenaran. |
| "Mikrofon sedang digunakan" | Tutup Zoom/Meet/Teams/WhatsApp atau tab lain yang menggunakan mikrofon. |
| Tepukan tidak dikesan | Tetapan → Kalibrasi; naikkan Sensitiviti; dekatkan peranti (30–100 cm). |
| Bunyi lain/gema dikira tepukan | Kalibrasi semula; turunkan Sensitiviti; naikkan Tempoh refraktori; gunakan fon kepala. |
| Sentiasa "lewat" | Tetapan → Kalibrasi → **Kalibrasi Latensi** (tepuk bersama 8 detikan). |
| Tiada bunyi pada iPhone | Matikan suis senyap (silent switch) & naikkan kelantangan; ketik butang sekali lagi (dasar autoplay). |
| Pengesanan tangan tidak dimuatkan | Model (~8 MB) dimuat turun dari CDN pada kali pertama — perlukan Internet. Latihan mikrofon tetap berfungsi. |
| Kamera hitam | Tutup aplikasi lain yang menggunakan kamera; cuba butang "Tukar kamera". |

## Batasan yang diketahui

- **Ketepatan belum diuji makmal.** Algoritma pengesanan tepukan dan pemarkahan diuji dengan isyarat sintetik dan aliran hujung-ke-hujung dalam Chromium tanpa kepala (peranti audio palsu). Ia **belum** diuji dengan murid sebenar di bilik darjah, pada iPhone/iPad, atau pada pelbagai mikrofon. Toleransi 120 ms ialah nilai awal — laraskan selepas ujian sebenar.
- **Pembesar suara + mikrofon.** Detikan metronom ditapis oleh reka bentuk frekuensi, tetapi pembesar suara yang sangat kuat/herot masih boleh menjejaskan pengesanan. Fon kepala disyorkan.
- **Pemarkahan dikira di peranti murid.** RLS & RPC menghalang pengubahsuaian rekod sedia ada, tetapi pengguna yang mahir teknikal masih boleh menghantar markah palsu melalui RPC. Untuk pentaksiran berisiko tinggi, pindahkan `scoringEngine.ts` (TypeScript tulen) ke Supabase Edge Function dan kira semula markah daripada `detected_claps` di pelayan.
- **Kamera tidak membuktikan tepukan.** Gerakan tangan hanya maklumat tambahan; markah dikira daripada bunyi.
- **AR** ialah "camera overlay" (tiada penjejakan permukaan/WebXR) — dipilih untuk kestabilan dan sokongan peranti yang luas.
- **MediaPipe** dimuat dari `cdn.jsdelivr.net` dan `storage.googleapis.com` (dicache oleh service worker selepas kali pertama). Rangkaian sekolah yang menyekat domain ini akan menyebabkan pengesanan tangan tidak tersedia.
- **Luar talian:** latihan asas, notasi, metronom dan pengesanan tepukan berfungsi selepas lawatan pertama pada kebanyakan pelayar; log masuk, penyegerakan awan dan muat turun model tangan kali pertama memerlukan Internet. Rekod yang dibuat semasa luar talian disimpan dalam peranti tetapi tidak dihantar semula secara automatik ke Supabase.
- **Tetapan penilaian umum** (pemberat, kategori) disimpan pada peranti guru; toleransi khas setiap latihan disimpan bersama latihan di Supabase.
- Bundle VexFlow (~390 kB gzip) dan Three.js (~245 kB gzip) dimuat secara malas.
- Kategori prestasi ialah kategori gamifikasi, **bukan** pengganti standard pentaksiran rasmi KPM.

## Lesen & kredit

Kod aplikasi untuk kegunaan pendidikan. Notasi dipaparkan oleh [VexFlow](https://github.com/vexflow/vexflow) (MIT) dengan fon SMuFL Bravura (SIL OFL). Pengesanan tangan oleh [MediaPipe](https://developers.google.com/mediapipe) (Apache 2.0).
