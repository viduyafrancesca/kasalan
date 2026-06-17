"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CheckSquare, LayoutDashboard, Users, Wallet, MoreHorizontal } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Home",     Icon: LayoutDashboard },
  { href: "/checklist", label: "Tasks",    Icon: CheckSquare },
  { href: "/budget",    label: "Budget",   Icon: Wallet },
  { href: "/guests",    label: "Guests",   Icon: Users },
  { href: "/more",      label: "More",     Icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border safe-area-bottom">
      <div className="flex max-w-lg mx-auto">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
                active ? "text-accent" : "text-muted-fg"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
