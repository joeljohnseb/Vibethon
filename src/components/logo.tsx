import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2ee88a" />
      <path d="M18.5 5 9 18h6l-1.5 9L23 14h-6l1.5-9Z" fill="#03140b" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Eber home">
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight">eber</span>
    </Link>
  );
}
