"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, UtensilsCrossed, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center">
      <div className="flex w-full max-w-[480px] items-center justify-around border-t border-stone-200 bg-white/95 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors",
                isActive ? "text-primary-700" : "text-stone-500 hover:text-stone-700",
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? "text-primary-500" : undefined}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
