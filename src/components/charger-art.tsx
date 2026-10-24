/** Illustrated placeholder used when a listing has no photos yet. */
export function ChargerArt({ seed = "x", className = "" }: { seed?: string; className?: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const variant = h % 3;
  const wall = ["#16201b", "#1a1d24", "#201b18"][variant];
  return (
    <svg viewBox="0 0 400 250" className={className} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Home charger illustration">
      <defs>
        <linearGradient id={`g${h}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={wall} />
          <stop offset="1" stopColor="#0c0f0d" />
        </linearGradient>
        <radialGradient id={`r${h}`} cx="0.5" cy="0.45" r="0.5">
          <stop offset="0" stopColor="#2ee88a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#2ee88a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#g${h})`} />
      <rect y="200" width="400" height="50" fill="#0b0d0c" />
      <path d="M0 200h400" stroke="#262c29" />
      {[...Array(8)].map((_, i) => (
        <path key={i} d={`M${20 + i * 52} 230h26`} stroke="#2a312d" strokeWidth="3" strokeLinecap="round" />
      ))}
      <circle cx="200" cy="110" r="120" fill={`url(#r${h})`} />
      <rect x="168" y="52" width="64" height="104" rx="14" fill="#1b211e" stroke="#343c38" />
      <rect x="180" y="66" width="40" height="22" rx="5" fill="#0d1210" />
      <circle cx="200" cy="77" r="4" fill="#2ee88a" />
      <path d="M204 100l-12 18h8l-3 14 13-19h-8l2-13Z" fill="#2ee88a" />
      <path d="M200 156c0 30-40 26-58 44" stroke="#2b322e" strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="126" y="194" width="24" height="12" rx="4" fill="#2b322e" />
    </svg>
  );
}
