import { prisma } from "@/lib/prisma";
import { GroupStageTable } from "@/components/world-cup/group-stage-table";
import { QualifierOdds } from "@/components/world-cup/qualifier-odds";
import { UEFA_PLAYOFFS, FIFA_PLAYOFFS, dbName } from "@/lib/world-cup-data";

export const dynamic = "force-dynamic";

export default async function GroupStagePage() {
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

  const qualifierOdds = sim.qualifierOdds as Record<string, {
    description: string;
    teams: Record<string, number>;
  }>;

  // Build set of playoff team names (keyed by target group)
  // Use dbName() to resolve WC names (e.g. "Czechia") to DB names ("Czech Republic")
  const playoffTeamsByGroup: Record<string, string[]> = {};
  for (const [, path] of Object.entries(UEFA_PLAYOFFS)) {
    playoffTeamsByGroup[path.targetGroup] = [
      ...path.semi1, ...path.semi2,
    ].map(dbName);
  }
  for (const [, path] of Object.entries(FIFA_PLAYOFFS)) {
    playoffTeamsByGroup[path.targetGroup] = [
      ...path.semi, path.finalOpponent,
    ].map(dbName);
  }

  return (
    <div className="space-y-8">
      <QualifierOdds qualifierOdds={qualifierOdds} />
      <GroupStageTable groupOdds={groupOdds} playoffTeamsByGroup={playoffTeamsByGroup} />
      <p className="text-xs text-muted-foreground text-center">
        Based on {sim.iterations.toLocaleString()} Monte Carlo simulations |
        Last updated {sim.createdAt.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        })}
      </p>
    </div>
  );
}
