import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { unreadCount } from "@/lib/services/notifications";
import { maybeRunMaintenance } from "@/lib/maintenance";
import { Header, BottomNav } from "@/components/header";
import { LogoMark } from "@/components/logo";
import { config } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Eber — Charge at homes near you", template: "%s · Eber" },
  description: "Eber connects EV drivers with homeowners who share their chargers. Find, book and pay for home charging nearby.",
};

export const viewport: Viewport = { themeColor: "#0a0c0b", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the session (cookies) first keeps every page request-time, so no DB access happens at build.
  const user = await getCurrentUser();
  await maybeRunMaintenance();
  const activeUser = user && !user.suspendedAt ? user : null;
  const unread = activeUser ? await unreadCount(activeUser.id) : 0;
  const sandbox = config.payments.mode === "sandbox" || config.sms.mode === "sandbox";

  return (
    <html lang="en-IN" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="min-h-dvh">
        {sandbox && (
          <div className="no-print border-b border-warn/20 bg-warn/10 px-4 py-1.5 text-center text-xs text-warn">
            Test mode — {[config.payments.mode === "sandbox" && "payments", config.sms.mode === "sandbox" && "SMS codes"].filter(Boolean).join(" and ")} are simulated. No real money moves.
          </div>
        )}
        <Header user={activeUser} unread={unread} />
        <main className={activeUser ? "pb-24 md:pb-0" : ""}>{children}</main>
        <Footer />
        {activeUser && <BottomNav role={activeUser.activeRole} />}
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="no-print mt-16 border-t border-line pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-display text-lg font-bold">eber</span>
          </div>
          <p className="mt-3 text-sm text-muted">Home charging, shared. Find a charger at a neighbour&apos;s home when public stations are busy or far away.</p>
        </div>
        <FooterCol title="Drivers" links={[["/chargers", "Find a charger"], ["/how-it-works", "How Eber works"], ["/bookings", "My bookings"]]} />
        <FooterCol title="Hosts" links={[["/register?role=giver", "List your charger"], ["/host", "Host dashboard"], ["/safety", "Safety guidelines"]]} />
        <FooterCol title="Eber" links={[["/help", "Help & disputes"], ["/legal/terms", "Terms of service"], ["/legal/privacy", "Privacy policy"]]} />
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-faint">© {new Date().getFullYear()} Eber. Energy estimates are based on battery readings, not metered consumption.</div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">{title}</div>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-muted hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
