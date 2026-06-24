"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CheckSquare, LayoutDashboard, Users, Wallet } from "lucide-react";
import { MORE_SECTIONS } from "@/lib/navigation";

const NAV = [
  { href: "/dashboard", label: "Home",      Icon: LayoutDashboard },
  { href: "/checklist", label: "Checklist", Icon: CheckSquare },
  { href: "/budget",    label: "Budget",    Icon: Wallet },
  { href: "/guests",    label: "Guests",    Icon: Users },
];

const HIDE_ON = ["/login", "/setup", "/share"];

export function SideNav() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-card border-r border-border z-40">
      <div className="px-5 py-6 border-b border-border">
        <p className="font-display text-xl text-foreground">Kasalan</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-fg mt-0.5">Wedding Planner</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-terra-100 text-accent"
                : "text-muted-fg hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        ))}

        <div className="my-2 border-t border-border" />

        {MORE_SECTIONS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-terra-100 text-accent"
                : "text-muted-fg hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
