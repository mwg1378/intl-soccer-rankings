import { prisma } from "@/lib/prisma";
import { PowerRankings, type PowerTeam } from "@/components/world-cup/power-rankings";
import { GROUPS, dbName, UEFA_PLAYOFFS, FIFA_PLAYOFFS, PLAYOFF_TEAMS } from "@/lib/world-cup-data";
import { CONSENSUS_ODDS } from "@/lib/market-odds";

export const dynamic = "force-dynamic";

export default async function PowerPage() {
  const sim = await prisma.worldCupSimulation.findFirst({
    orderBy: { createdAt: "desc" },
  });

  // Build set of all WC team names (DB names)
  const wcTeamNames = new Set<string>();
  for (const teams of Object.values(GROUPS)) {
    for (const t of teams) {
      if (!t.startsWith("__")) {
        wcTeamNames.add(dbName(t));
      }
    }
  }
  // Add playoff teams
  for (const t of PLAYOFF_TEAMS) {
    wcTeamNames.add(dbName(t));
  }

  // Fetch all WC teams from DB
  const dbTeams = await prisma.team.findMany({
    where: { name: { in: [...wcTeamNames] } },
    select: {
      name: true,
      slug: true,
      confederation: true,
      gridOptOff: true,
      gridOptDef: true,
      currentOverallRating: true,
    },
  });

  // Build group lookup
  const teamToGroup = new Map<string, string>();
  for (const [groupId, teams] of Object.entries(GROUPS)) {
    for (const t of teams) {
      if (!t.startsWith("__")) {
        teamToGroup.set(dbName(t), groupId);
      }
    }
  }
  // Playoff teams → target group
  for (const [, path] of Object.entries(UEFA_PLAYOFFS)) {
    for (const t of path.final) {
      teamToGroup.set(dbName(t), path.targetGroup);
    }
  }
  for (const [, path] of Object.entries(FIFA_PLAYOFFS)) {
    for (const t of path.final) {
      teamToGroup.set(dbName(t), path.targetGroup);
    }
  }

  // Get advancement odds from simulation
  const advancementOdds = (sim?.advancementOdds ?? {}) as Record<string, {
    name: string;
    group: string;
    probChampion: number;
  }>;

  // Build power teams list
  const powerTeams: PowerTeam[] = dbTeams.map((t) => {
    const advOdds = Object.values(advancementOdds).find(
      (a) => a.name === t.name
    );
    const marketProb = CONSENSUS_ODDS[t.name] ?? 0;

    return {
      name: t.name,
      slug: t.slug,
      group: teamToGroup.get(t.name) ?? "?",
      confederation: t.confederation,
      overallRating: t.currentOverallRating,
      offensiveRating: t.gridOptOff,
      defensiveRating: t.gridOptDef,
      champProb: advOdds?.probChampion ?? 0,
      marketProb,
      rank: 0,
    };
  });

  // Sort by overall rating and assign ranks
  powerTeams.sort((a, b) => b.overallRating - a.overallRating);
  powerTeams.forEach((t, i) => { t.rank = i + 1; });

  const ratings = powerTeams.map((t) => t.overallRating);
  const ratingRange = {
    min: Math.min(...ratings),
    max: Math.max(...ratings),
  };

  return (
    <PowerRankings teams={powerTeams} ratingRange={ratingRange} />
  );
}
