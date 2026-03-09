import { prisma } from "@/lib/prisma";
import { BracketTable } from "@/components/world-cup/bracket-table";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const sim = await prisma.worldCupSimulation.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!sim) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">No simulation data</h2>
        <p className="mt-2 text-muted-foreground">
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
        <h2 className="text-xl font-semibold">Round of 32 Bracket Probabilities</h2>
        <p className="text-sm text-muted-foreground">
          Probability each team appears in each R32 bracket slot. Especially
          interesting for 3rd-place team assignments which vary based on which
          groups produce qualifying 3rd-place teams.
        </p>
      </div>
      <BracketTable bracketOdds={bracketOdds} groupOdds={groupOdds} />
      <p className="text-xs text-muted-foreground text-center">
        Based on {sim.iterations.toLocaleString()} Monte Carlo simulations |
        Last updated {sim.createdAt.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        })}
      </p>
    </div>
  );
}
