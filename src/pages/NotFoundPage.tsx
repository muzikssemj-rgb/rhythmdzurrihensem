import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="card p-8 text-center max-w-md mx-auto mt-10">
      <div className="font-display text-6xl font-bold text-gradient">404</div>
      <p className="mt-2 text-slate-300">Halaman tidak dijumpai. Mungkin pautan telah berubah.</p>
      <Link to="/" className="btn-primary mt-5">
        Kembali ke Menu Utama
      </Link>
    </div>
  );
}
