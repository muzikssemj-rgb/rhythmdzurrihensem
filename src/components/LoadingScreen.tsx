import { Music } from 'lucide-react';

export function LoadingScreen({ text = 'Memuatkan…' }: { text?: string }) {
  return (
    <div className="min-h-[60dvh] flex flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="relative">
        <div className="size-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-ink-950 animate-float shadow-[0_0_40px_rgba(34,211,238,0.35)]">
          <Music size={32} strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-2 h-6 rounded-full bg-cyan-300/80 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-slate-300 font-bold tracking-wide">{text}</p>
    </div>
  );
}
