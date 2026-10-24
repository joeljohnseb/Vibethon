import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "./logo";
import { buttonClass } from "./ui";
import { NavLinks, MobileMenu, UserMenu, RoleSwitch, BottomNav } from "./nav-client";
import type { CurrentUser } from "@/lib/auth/session";

export type NavUser = Pick<CurrentUser, "id" | "name" | "activeRole" | "isAdmin" | "avatarUrl">;

export function navItems(user: NavUser | null) {
  if (!user)
    return [
      { href: "/chargers", label: "Find chargers" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/register?role=giver", label: "Host your charger" },
    ];
  if (user.activeRole === "giver")
    return [
      { href: "/host", label: "Dashboard" },
      { href: "/host/bookings", label: "Bookings" },
      { href: "/host/chargers", label: "Listings" },
      { href: "/host/earnings", label: "Earnings" },
    ];
  return [
    { href: "/chargers", label: "Find chargers" },
    { href: "/bookings", label: "My bookings" },
    { href: "/reviews", label: "Reviews" },
  ];
}

export function Header({ user, unread }: { user: NavUser | null; unread: number }) {
  const items = navItems(user);
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/80 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo href={user ? (user.activeRole === "giver" ? "/host" : "/chargers") : "/"} />
        <NavLinks items={items} />
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden md:block">
                <RoleSwitch role={user.activeRole} />
              </div>
              <Link
                href="/notifications"
                className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
              >
                <Bell size={20} />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-volt px-1 text-[10px] font-bold text-volt-ink">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm") + " hidden sm:inline-flex"}>
                Sign in
              </Link>
              <Link href="/register" className={buttonClass("primary", "sm")}>
                Get started
              </Link>
              <MobileMenu items={items} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export { BottomNav };
