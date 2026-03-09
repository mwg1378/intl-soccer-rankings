import type { Metadata } from "next";
import { WorldCupNav } from "@/components/world-cup/world-cup-nav";

export const metadata: Metadata = {
  title: "2026 FIFA World Cup Simulator",
  description:
    "Monte Carlo simulation of the 2026 FIFA World Cup with probabilistic forecasts.",
};

export default function WorldCupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          2026 FIFA World Cup Simulator
        </h1>
        <p className="text-muted-foreground">
          10,000 Monte Carlo simulations based on current team ratings
        </p>
      </div>
      <WorldCupNav />
      {children}
    </div>
  );
}
