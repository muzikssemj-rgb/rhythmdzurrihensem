// Pembungkus localStorage yang selamat (mod peribadi / storan disekat tidak merosakkan aplikasi).

const PREFIX = 'rhythm-master-ar:v1:';

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* abaikan */
  }
}

export function storageAvailable(): boolean {
  try {
    const k = PREFIX + '__test';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function uid(prefix = ''): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return prefix + c.randomUUID();
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
