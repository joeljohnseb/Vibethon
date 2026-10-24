import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export const buttonClass = (variant: Variant = "primary", size: Size = "md", full = false) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none whitespace-nowrap",
    "disabled:opacity-50 disabled:pointer-events-none",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-[15px]",
    size === "lg" && "h-13 px-6 text-base",
    variant === "primary" && "bg-volt text-volt-ink hover:bg-volt-bright shadow-[0_0_0_1px_rgba(46,232,138,.4),0_8px_24px_-12px_rgba(46,232,138,.6)]",
    variant === "secondary" && "bg-surface-3 text-ink hover:bg-line-strong border border-line",
    variant === "outline" && "border border-line-strong text-ink hover:border-volt hover:text-volt",
    variant === "ghost" && "text-muted hover:text-ink hover:bg-surface-2",
    variant === "danger" && "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
    full && "w-full",
  );

export function Button({
  variant,
  size,
  full,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; full?: boolean }) {
  return <button className={cn(buttonClass(variant, size, full), className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  full,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; full?: boolean }) {
  return <Link className={cn(buttonClass(variant, size, full), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "volt" | "warn" | "danger" | "info";
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "border-line-strong bg-surface-2 text-muted",
        tone === "volt" && "border-volt/30 bg-volt/10 text-volt",
        tone === "warn" && "border-warn/30 bg-warn/10 text-warn",
        tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
        tone === "info" && "border-info/30 bg-info/10 text-info",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "volt" }: { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        tone === "volt" && "bg-volt shadow-[0_0_8px] shadow-volt",
        tone === "warn" && "bg-warn",
        tone === "danger" && "bg-danger",
        tone === "info" && "bg-info",
        tone === "neutral" && "bg-faint",
      )}
    />
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-volt">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-volt">{icon}</div>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className={cn("mt-1.5 font-display text-2xl font-semibold", accent && "text-volt")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function Stars({ value, count, size = 14 }: { value: number | null; count?: number; size?: number }) {
  if (value === null) return <span className="text-sm text-faint">New · no reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star size={size} className="fill-warn text-warn" />
      <span className="font-semibold text-ink">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted">({count})</span>}
    </span>
  );
}

export function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className={i <= rating ? "fill-warn text-warn" : "text-line-strong"} />
      ))}
    </span>
  );
}

export function KV({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", className)}>
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="text-right text-sm font-medium">{v}</dd>
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "info" && "border-info/25 bg-info/5 text-info",
        tone === "warn" && "border-warn/25 bg-warn/5 text-warn",
        tone === "danger" && "border-danger/25 bg-danger/5 text-danger",
        tone === "volt" && "border-volt/25 bg-volt/5 text-volt",
        tone === "neutral" && "border-line bg-surface-2 text-muted",
        className,
      )}
    >
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      <div className={cn(title && "text-ink/80")}>{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 h-11 text-[15px] text-ink placeholder:text-faint outline-none transition focus:border-volt focus:ring-2 focus:ring-volt/20 aria-[invalid=true]:border-danger";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink/90">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, error, ...props }: ComponentProps<"input"> & { error?: string }) {
  return <input aria-invalid={error ? true : undefined} className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, error, ...props }: ComponentProps<"textarea"> & { error?: string }) {
  return <textarea aria-invalid={error ? true : undefined} className={cn(inputClass, "h-auto min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, error, ...props }: ComponentProps<"select"> & { error?: string }) {
  return <select aria-invalid={error ? true : undefined} className={cn(inputClass, "appearance-none pr-8", className)} {...props} />;
}

export function Section({ title, children, action, className }: { title: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn("mb-8", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
              active === t.key ? "bg-surface-3 text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn("rounded-full px-1.5 text-xs", active === t.key ? "bg-volt text-volt-ink" : "bg-surface-3 text-muted")}>{t.count}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
