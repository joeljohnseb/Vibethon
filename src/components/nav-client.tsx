"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  PlugZap,
  Settings,
  Shield,
  Star,
  User,
  Wallet,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { logoutAction, switchRoleAction } from "@/app/actions/auth";

type Item = { href: string; label: string };
type NavUser = { id: string; name: string; activeRole: "taker" | "giver"; isAdmin: boolean; avatarUrl: string | null };

const isActive = (path: string, href: string) => (href === "/host" ? path === "/host" : path === href || path.startsWith(href + "/"));

export function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="ml-4 hidden items-center gap-1 md:flex">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            isActive(path, i.href.split("?")[0]) ? "text-ink" : "text-muted hover:text-ink",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function RoleSwitch({ role, full }: { role: "taker" | "giver"; full?: boolean }) {
  return (
    <form action={switchRoleAction} className={cn("flex rounded-xl border border-line bg-surface p-0.5 text-sm", full && "w-full")}>
      {(["taker", "giver"] as const).map((r) => (
        <button
          key={r}
          name="role"
          value={r}
          aria-pressed={role === r}
          className={cn(
            "flex-1 rounded-[10px] px-3 py-1.5 font-medium transition",
            role === r ? "bg-volt text-volt-ink" : "text-muted hover:text-ink",
          )}
        >
          {r === "taker" ? "Driver" : "Host"}
        </button>
      ))}
    </form>
  );
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const links = [
    { href: "/profile", label: "Profile & vehicles", icon: User },
    { href: "/settings", label: "Account settings", icon: Settings },
    { href: "/reviews", label: "Reviews", icon: Star },
    { href: "/help", label: "Help & disputes", icon: HelpCircle },
    ...(user.isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl p-1 pr-2 hover:bg-surface-2"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="grid size-8 place-items-center overflow-hidden rounded-lg bg-surface-3 text-xs font-bold text-volt">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : initials(user.name)}
        </span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl shadow-black/50">
          <div className="border-b border-line px-4 py-3">
            <div className="truncate font-medium">{user.name}</div>
            <div className="text-xs text-muted">{user.activeRole === "giver" ? "Host mode" : "Driver mode"}</div>
          </div>
          <div className="p-2 md:hidden">
            <RoleSwitch role={user.activeRole} full />
          </div>
          <div className="p-1.5">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-3 hover:text-ink">
                <l.icon size={16} /> {l.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-3 hover:text-danger">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileMenu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen((o) => !o)} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2" aria-label="Menu" aria-expanded={open}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-line bg-bg p-4">
          {items.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-surface-2">
              {i.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-base font-medium text-muted hover:bg-surface-2">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}

export function BottomNav({ role }: { role: "taker" | "giver" }) {
  const path = usePathname();
  const items =
    role === "giver"
      ? [
          { href: "/host", label: "Dashboard", icon: LayoutDashboard },
          { href: "/host/bookings", label: "Bookings", icon: CalendarClock },
          { href: "/host/chargers", label: "Listings", icon: PlugZap },
          { href: "/host/earnings", label: "Earnings", icon: Wallet },
        ]
      : [
          { href: "/chargers", label: "Find", icon: Map },
          { href: "/bookings", label: "Bookings", icon: CalendarClock },
          { href: "/profile", label: "Vehicles", icon: Gauge },
          { href: "/help", label: "Help", icon: HelpCircle },
        ];
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4">
        {items.map((i) => {
          const active = isActive(path, i.href);
          return (
            <Link key={i.href} href={i.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-volt" : "text-faint")}>
              <i.icon size={20} />
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
