import { prisma } from "@/lib/prisma";
import { MarketAlignmentView } from "@/components/market-alignment/market-alignment-view";
import { MARKET_SOURCES } from "@/lib/market-odds";
import { compareToMarket, computeMetrics, generateDisagreementReport } from "@/lib/market-alignment";
import { MARKET_OBSERVATIONS } from "@/lib/market-observations";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Alignment | Soccer Rankings",
  description:
    "How our model compares to sportsbook consensus World Cup 2026 odds. Disagreement analysis with justifications.",
};

export default async function MarketAlignmentPage() {
  const sim = await prisma.worldCupSimulation.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!sim) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">No simulation data</h2>
        <p className="mt-2 text-gray-400">
          Run the simulation script to generate World Cup forecasts, then compare against market odds.
        </p>
      </div>
    );
  }

  // Extract model championship probabilities from simulation
  const advancementOdds = sim.advancementOdds as Record<string, {
    name: string;
    group: string;
    probChampion: number;
  }>;

  // Build model odds keyed by team name
  const modelOdds: Record<string, number> = {};
  for (const [, data] of Object.entries(advancementOdds)) {
    modelOdds[data.name] = data.probChampion;
  }

  const comparisons = compareToMarket(modelOdds, sim.iterations);
  const metrics = computeMetrics(comparisons);
  const disagreements = generateDisagreementReport(comparisons);

  // Top 30 teams for the table
  const top30 = comparisons
    .filter(c => c.consensusProb > 0.001 || c.modelProb > 0.001)
    .sort((a, b) => b.consensusProb - a.consensusProb)
    .slice(0, 30);

  return (
    <MarketAlignmentView
      comparisons={top30}
      metrics={metrics}
      disagreements={disagreements}
      observations={MARKET_OBSERVATIONS}
      marketSources={MARKET_SOURCES}
      simIterations={sim.iterations}
      simDate={sim.createdAt.toISOString()}
    />
  );
}
