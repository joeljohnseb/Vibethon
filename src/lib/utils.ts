import clsx, { type ClassValue } from "clsx";
export const cn = (...c: ClassValue[]) => clsx(c);
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
