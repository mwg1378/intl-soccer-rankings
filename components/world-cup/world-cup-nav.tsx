"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/world-cup/groups", label: "Table" },
  { href: "/world-cup/matches", label: "Group Matches" },
  { href: "/world-cup/bracket", label: "Knockout" },
  { href: "/world-cup/advancement", label: "Advancement" },
  { href: "/world-cup/power", label: "Power Rankings", beta: true },
  { href: "/market-alignment", label: "Market Odds" },
  { href: "/world-cup/scenarios", label: "What If", beta: true },
];

export function WorldCupNav() {
  const pathname = usePathname();

  return (
    <nav className="relative">
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 scrollbar-none">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors -mb-px flex items-center gap-1 whitespace-nowrap flex-shrink-0",
              pathname === tab.href
                ? "text-[#1a2b4a] border-[#1a2b4a]"
                : "text-gray-400 border-transparent hover:text-gray-700 hover:border-gray-300"
            )}
          >
            {tab.label}
            {"beta" in tab && tab.beta && (
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold uppercase leading-none text-amber-700">
                Beta
              </span>
            )}
          </Link>
        ))}
      </div>
      {/* Fade indicator for horizontal scroll on mobile */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden" />
    </nav>
  );
}
