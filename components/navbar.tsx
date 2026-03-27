"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/rankings/compare", label: "Rankings" },
  { href: "/world-cup", label: "World Cup 2026" },
  { href: "/predict", label: "Predictions" },
  { href: "/market-alignment", label: "vs Market" },
  { href: "/methodology", label: "Methodology" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full bg-[#1a2b4a] text-white shadow-md">
      <div className="container mx-auto flex h-11 items-center px-4">
        <Link href="/" className="mr-8 flex items-center gap-2 font-bold text-sm tracking-wide">
          <span className="text-[#40C28A]">&#9917;</span>
          <span>Soccer Rankings</span>
        </Link>
        <nav className="flex items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                (pathname === link.href ||
                  (link.href === "/rankings/compare" && pathname.startsWith("/rankings")) ||
                  (link.href !== "/" && link.href !== "/rankings/compare" && pathname.startsWith(link.href)))
                  ? "text-[#40C28A]"
                  : "text-white/70 hover:text-white"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
