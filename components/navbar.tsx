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
  { href: "/market-alignment", label: "Market Odds" },
  { href: "/backtests", label: "Backtests" },
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
    <header className="sticky top-0 z-50 w-full bg-white shadow-[0px_2px_6px_0px_rgba(0,0,0,0.15)]">
      <div className="border-b border-[#dedede] bg-[#f1f1f1]">
        <div className="container mx-auto flex h-7 items-center px-4">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-sm text-[#333] tracking-wide">
            <span className="text-[#399F49]">&#9917;</span>
            <span>Soccer Rankings</span>
          </Link>
        </div>
      </div>
      <div className="container mx-auto flex h-10 items-center px-4">
        {/* Desktop nav */}
        <nav className="hidden md:flex items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 text-[13px] font-bold transition-colors",
                isActive(pathname, link.href)
                  ? "text-[#399F49]"
                  : "text-[#333] opacity-65 hover:opacity-100"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <div className="ml-auto md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="flex h-8 w-8 items-center justify-center rounded text-[#399F49] hover:text-[#117F23]"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-white text-[#333] border-[#dedede]">
              <SheetHeader>
                <SheetTitle className="text-[#333] flex items-center gap-2">
                  <span className="text-[#399F49]">&#9917;</span>
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
                      "rounded px-3 py-2.5 text-sm font-bold transition-colors",
                      isActive(pathname, link.href)
                        ? "bg-[#f1f1f1] text-[#399F49]"
                        : "text-[#333] opacity-65 hover:opacity-100 hover:bg-[#f1f1f1]"
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
