import { prisma } from "@/lib/prisma";
import { AdvancementTable } from "@/components/world-cup/advancement-table";

export const dynamic = "force-dynamic";

export default async function AdvancementPage() {
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
    probQualify: number;
    probGroupStage: number;
    probR32: number;
    probR16: number;
    probQF: number;
    probSF: number;
    probFinal: number;
    probChampion: number;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tournament Advancement Probabilities</h2>
        <p className="text-sm text-gray-400">
          Probability each team reaches each stage of the tournament.
          For playoff teams, &quot;Qualify&quot; shows the probability of making the World Cup.
        </p>
      </div>
      <AdvancementTable advancementOdds={advancementOdds} />
      <p className="text-xs text-gray-400 text-center">
        Based on {sim.iterations.toLocaleString()} Monte Carlo simulations |
        Last updated {sim.createdAt.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        })}
      </p>
    </div>
  );
}
