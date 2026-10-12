export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id="lg-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="lg-note" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="#0b0a24" />
      <circle cx="256" cy="256" r="196" fill="none" stroke="url(#lg-ring)" strokeWidth="22" />
      <g fill="url(#lg-note)">
        <ellipse cx="190" cy="330" rx="46" ry="34" transform="rotate(-20 190 330)" />
        <ellipse cx="330" cy="300" rx="46" ry="34" transform="rotate(-20 330 300)" />
        <rect x="224" y="150" width="18" height="182" rx="6" />
        <rect x="364" y="120" width="18" height="182" rx="6" />
        <path d="M224 150 L382 120 L382 168 L224 198 Z" />
      </g>
    </svg>
  );
}
