"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/world-cup/groups", label: "Group Stage" },
  { href: "/world-cup/bracket", label: "Bracket" },
  { href: "/world-cup/advancement", label: "Advancement" },
];

export function WorldCupNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            pathname === tab.href
              ? "text-foreground border-foreground"
              : "text-muted-foreground border-transparent hover:text-foreground hover:border-foreground/30"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
