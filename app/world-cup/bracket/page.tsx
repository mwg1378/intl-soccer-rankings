import { prisma } from "@/lib/prisma";
import { KnockoutBracket } from "@/components/world-cup/knockout-bracket";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
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

  const bracketOdds = sim.bracketOdds as Record<string, {
    description: string;
    teams: Record<string, number>;
  }>;

  const groupOdds = sim.groupOdds as Record<string, {
    group: string;
    name: string;
    probFirst: number;
    probSecond: number;
    probThird: number;
    probFourth: number;
    probAdvance: number;
    avgPoints: number;
    avgGD: number;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Knockout: Who Plays Where</h2>
        <p className="text-sm text-gray-400">
          Probability each team appears in each knockout bracket slot, based on
          group finishing position and 3rd-place assignment simulations.
        </p>
      </div>
      <KnockoutBracket bracketOdds={bracketOdds} groupOdds={groupOdds} />
      <p className="text-xs text-gray-400 text-center">
        Based on {sim.iterations.toLocaleString()} Monte Carlo simulations |
        Last updated {sim.createdAt.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        })}
      </p>
    </div>
  );
}
