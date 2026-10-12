// Bunyi sintesis (tiada fail audio luaran diperlukan — berfungsi luar talian).

/**
 * Detikan metronom: nada sinus 660 Hz (aksen 880 Hz) dengan sampul lembut.
 * Frekuensi rendah dipilih supaya detikan yang bocor ke mikrofon ditapis oleh
 * penapis high-pass pengesan tepukan (2.5 kHz) dan tidak dikira sebagai tepukan.
 */
export function scheduleClick(ctx: BaseAudioContext, dest: AudioNode, time: number, accent: boolean, volume = 0.8) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = accent ? 880 : 660;
  const peak = Math.max(0.0001, volume * (accent ? 0.9 : 0.6));
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  osc.connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + 0.1);
  return osc;
}

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.25);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseBuf = b;
  return b;
}

/** Bunyi tepukan sintetik (untuk "Dengar Contoh"). Not panjang diberi bunyi "woodblock" yang bertahan. */
export function scheduleClapSound(ctx: BaseAudioContext, dest: AudioNode, time: number, volume = 0.9, sustainSec = 0) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  src.connect(bp).connect(g).connect(dest);
  src.start(time);
  src.stop(time + 0.15);

  // Nada lembut menunjukkan tempoh not (minim, semibrif, dsb.)
  if (sustainSec > 0.3) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 392;
    og.gain.setValueAtTime(0.0001, time);
    og.gain.exponentialRampToValueAtTime(volume * 0.12, time + 0.02);
    og.gain.setValueAtTime(volume * 0.12, time + sustainSec * 0.85);
    og.gain.exponentialRampToValueAtTime(0.0001, time + sustainSec * 0.98);
    o.connect(og).connect(dest);
    o.start(time);
    o.stop(time + sustainSec);
  }
}

export function scheduleChime(ctx: BaseAudioContext, dest: AudioNode, time: number, good = true) {
  const notes = good ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.23];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const t = time + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.45);
  });
}
