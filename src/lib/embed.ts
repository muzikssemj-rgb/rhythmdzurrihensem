// Kesan jika aplikasi dibuka di dalam iframe (cth. hub Playverse).
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Buka halaman semasa dalam tab baharu (keluar dari iframe) supaya mikrofon/kamera boleh dibenarkan. */
export function openInNewTab() {
  window.open(window.location.href, '_blank', 'noopener');
}

export const EMBED_HINT =
  'Aplikasi ini dibuka di dalam hub (iframe) yang belum membenarkan mikrofon/kamera. Tekan "Buka dalam Tab Baharu", atau minta pemilik hub menambah allow="microphone; camera" pada iframe.';
