import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/** Pendaftaran service worker + gesaan kemas kini versi baharu. */
export function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn('[PWA] pendaftaran service worker gagal', err);
    },
  });
  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="fixed z-40 left-4 right-4 sm:left-auto sm:right-6 bottom-24 md:bottom-6 sm:max-w-sm card p-4 animate-rise" role="status">
      <p className="text-sm font-bold mb-3">
        {needRefresh ? 'Versi baharu Rhythm Master AR tersedia.' : 'Aplikasi sedia digunakan luar talian (latihan asas & notasi).'}
      </p>
      <div className="flex gap-2">
        {needRefresh && (
          <button className="btn-primary !min-h-10 !py-2" onClick={() => void updateServiceWorker(true)}>
            <RefreshCw size={16} /> Kemas kini
          </button>
        )}
        <button
          className="btn-ghost !min-h-10 !py-2"
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
