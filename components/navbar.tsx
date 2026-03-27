"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/rankings/compare", label: "Rankings" },
  { href: "/world-cup", label: "World Cup 2026" },
  { href: "/predict", label: "Predictions" },
  { href: "/market-alignment", label: "vs Market" },
  { href: "/methodology", label: "Methodology" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/rankings/compare") return pathname.startsWith("/rankings");
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#1a2b4a] text-white shadow-md">
      <div className="container mx-auto flex h-11 items-center px-4">
        <Link href="/" className="mr-8 flex items-center gap-2 font-bold text-sm tracking-wide">
          <span className="text-[#40C28A]">&#9917;</span>
          <span>Soccer Rankings</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                isActive(pathname, link.href)
                  ? "text-[#40C28A]"
                  : "text-white/70 hover:text-white"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="ml-auto md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger>
              <button
                className="flex h-8 w-8 items-center justify-center rounded text-white/80 hover:text-white"
                aria-label="Open menu"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 5h14M3 10h14M3 15h14" />
                </svg>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-[#1a2b4a] text-white border-[#1a2b4a]">
              <SheetHeader>
                <SheetTitle className="text-white flex items-center gap-2">
                  <span className="text-[#40C28A]">&#9917;</span>
                  Soccer Rankings
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded px-3 py-2.5 text-sm font-semibold transition-colors",
                      isActive(pathname, link.href)
                        ? "bg-white/10 text-[#40C28A]"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
