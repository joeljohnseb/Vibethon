export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-1.5">
      {children}
    </div>
  );
}
