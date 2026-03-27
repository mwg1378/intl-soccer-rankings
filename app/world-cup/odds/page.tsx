import { prisma } from "@/lib/prisma";
import { MarketComparison } from "@/components/world-cup/market-comparison";
import { compareToMarket, computeMetrics, generateDisagreementReport } from "@/lib/market-alignment";

export const dynamic = "force-dynamic";

export default async function OddsPage() {
  const sim = await prisma.worldCupSimulation.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!sim) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">No simulation data</h2>
        <p className="mt-2 text-gray-400">
          Run the simulation script to generate World Cup forecasts.
        </p>
      </div>
    );
  }

  const advancementOdds = sim.advancementOdds as Record<string, {
    name: string;
    group: string;
    probChampion: number;
  }>;

  // Build model odds keyed by team name
  const modelOdds: Record<string, number> = {};
  for (const [, data] of Object.entries(advancementOdds)) {
    if (data.probChampion > 0) {
      modelOdds[data.name] = data.probChampion;
    }
  }

  const comparisons = compareToMarket(modelOdds);
  const metrics = computeMetrics(comparisons);
  const disagreements = generateDisagreementReport(comparisons);

  return (
    <div className="space-y-6">
      <MarketComparison
        comparisons={comparisons}
        metrics={metrics}
        disagreements={disagreements}
      />
      <p className="text-xs text-gray-400 text-center">
        Model: {sim.iterations.toLocaleString()} Monte Carlo simulations |
        Market: Sportsbooks + Polymarket consensus (March 27, 2026) |
        Last updated {sim.createdAt.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        })}
      </p>
    </div>
  );
}
