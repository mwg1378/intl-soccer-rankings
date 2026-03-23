/**
 * Estimate player caps and international goals from match history.
 *
 * Since we don't have per-player match data, we estimate:
 * - Caps: based on roster role (STARTER ~80% of matches, ROTATION ~40%, BENCH ~15%)
 * - Goals: based on team's total goals and player position weighting
 *
 * Usage: npx tsx scripts/estimate-caps-goals.ts
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Appearance rate by roster role (fraction of team matches played)
const APPEARANCE_RATE = {
  STARTER: 0.75,
  ROTATION: 0.35,
  BENCH: 0.12,
};

// Goal share by position (fraction of team goals a player at this position scores)
// Assumes ~23-man squad with 11 starters
const GOALS_PER_POSITION = {
  FWD: 0.12,  // a starting FWD scores ~12% of team's goals
  MID: 0.05,
  DEF: 0.015,
  GK: 0.001,
};

// Reduce for non-starters
const ROLE_GOAL_MULT = {
  STARTER: 1.0,
  ROTATION: 0.3,
  BENCH: 0.05,
};

async function main() {
  console.log("=== Estimate Player Caps & Goals ===\n");

  // Get team match counts and total goals since 2014
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
  });
  const teamIdToName = new Map(teams.map(t => [t.id, t.name]));

  // Count matches and goals per team
  const teamStats = new Map<string, { matches: number; goalsFor: number }>();

  const homeMatches = await prisma.match.groupBy({
    by: ["homeTeamId"],
    _count: { id: true },
    _sum: { homeScore: true },
  });
  for (const m of homeMatches) {
    const existing = teamStats.get(m.homeTeamId) || { matches: 0, goalsFor: 0 };
    existing.matches += m._count.id;
    existing.goalsFor += m._sum.homeScore || 0;
    teamStats.set(m.homeTeamId, existing);
  }

  const awayMatches = await prisma.match.groupBy({
    by: ["awayTeamId"],
    _count: { id: true },
    _sum: { awayScore: true },
  });
  for (const m of awayMatches) {
    const existing = teamStats.get(m.awayTeamId) || { matches: 0, goalsFor: 0 };
    existing.matches += m._count.id;
    existing.goalsFor += m._sum.awayScore || 0;
    teamStats.set(m.awayTeamId, existing);
  }

  console.log(`Computed stats for ${teamStats.size} teams`);

  // Get all roster entries with player data
  const rosterEntries = await prisma.teamRoster.findMany({
    include: {
      player: { select: { id: true, position: true } },
    },
  });

  console.log(`Processing ${rosterEntries.length} roster entries...\n`);

  let updated = 0;
  for (const entry of rosterEntries) {
    const stats = teamStats.get(entry.teamId);
    if (!stats) continue;

    const role = entry.rosterRole as keyof typeof APPEARANCE_RATE;
    const pos = entry.player.position as keyof typeof GOALS_PER_POSITION;

    // Estimate caps
    const appearanceRate = APPEARANCE_RATE[role] || 0.12;
    const estimatedCaps = Math.round(stats.matches * appearanceRate);

    // Estimate goals
    const goalShare = GOALS_PER_POSITION[pos] || 0.02;
    const roleMult = ROLE_GOAL_MULT[role] || 0.05;
    const estimatedGoals = Math.round(stats.goalsFor * goalShare * roleMult);

    await prisma.teamRoster.update({
      where: { id: entry.id },
      data: {
        caps: estimatedCaps,
        internationalGoals: estimatedGoals,
      },
    });
    updated++;
  }

  console.log(`Updated ${updated} roster entries with estimated caps/goals`);

  // Print sample
  const sample = await prisma.teamRoster.findMany({
    where: { team: { name: "Spain" } },
    include: { player: { select: { name: true, position: true } } },
    orderBy: { caps: "desc" },
    take: 10,
  });

  console.log("\nSample: Spain roster");
  console.log("Name                          Pos  Role      Caps  Goals");
  for (const r of sample) {
    console.log(
      `${r.player.name.padEnd(30)} ${r.player.position.padEnd(4)} ${r.rosterRole.padEnd(9)} ${String(r.caps).padStart(4)}  ${String(r.internationalGoals).padStart(5)}`
    );
  }

  await prisma.$disconnect();
  console.log("\n=== Done! ===");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
