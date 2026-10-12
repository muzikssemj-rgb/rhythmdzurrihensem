import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RhythmMaster] Ralat tidak dijangka', error, info);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center space-y-3">
          <h1 className="text-2xl font-bold">Alamak, ada masalah</h1>
          <p className="text-slate-300">
            {chunk
              ? 'Fail aplikasi tidak dapat dimuatkan. Semak sambungan Internet atau muat semula halaman (versi baharu mungkin telah diterbitkan).'
              : 'Ralat tidak dijangka berlaku. Kemajuan anda yang telah disimpan tidak terjejas.'}
          </p>
          <p className="text-xs text-slate-500 break-words">{this.state.error.message}</p>
          <div className="flex gap-2 justify-center">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Muat Semula
            </button>
            <button className="btn-ghost" onClick={() => (window.location.href = '/')}>
              Menu Utama
            </button>
          </div>
        </div>
      </div>
    );
  }
}
