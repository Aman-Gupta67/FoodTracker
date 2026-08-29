"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, ScanBarcode, UtensilsCrossed, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/add?scan=1", label: "Scan", icon: ScanBarcode, match: "/add" },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-[480px] items-center justify-around rounded-[22px] bg-white p-2 shadow-lg">
        {TABS.map(({ href, label, icon: Icon, ...rest }) => {
          const match = "match" in rest ? rest.match : href;
          const isActive = match === "/" ? pathname === "/" : pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-0.5 px-4 py-1.5"
            >
              {isActive ? (
                <motion.span
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-2xl bg-primary-100"
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                />
              ) : null}
              <Icon
                size={21}
                strokeWidth={isActive ? 2.3 : 2}
                className={cn(
                  "relative transition-colors",
                  isActive ? "text-primary-700" : "text-stone-400",
                )}
              />
              <span
                className={cn(
                  "relative text-[10.5px] font-semibold transition-colors",
                  isActive ? "text-primary-700" : "text-stone-400",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
