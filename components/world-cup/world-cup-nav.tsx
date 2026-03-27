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
  { href: "/world-cup/odds", label: "vs Market", beta: true },
  { href: "/world-cup/scenarios", label: "What If", beta: true },
];

export function WorldCupNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors -mb-px flex items-center gap-1",
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
    </nav>
  );
}
