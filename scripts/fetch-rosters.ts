/**
 * Apply Razali/Yeung roster ratings to team records.
 *
 * Reads the latest TeamSeasonRazali data (from load-fifa-ratings.ts)
 * and updates each team's rosterOffensive/rosterDefensive fields,
 * then recomputes the combined rating (50/50 Elo + Razali blend).
 *
 * Usage: npx tsx scripts/fetch-rosters.ts
 * Prerequisite: Run load-fifa-ratings.ts first to populate TeamSeasonRazali.
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { combinedRating } from "../lib/ranking-engine";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const url = new URL(connectionString);
const pool = new pg.Pool({
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  host: url.hostname,
  port: parseInt(url.port || "5432", 10),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  max: 5,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== Apply Razali Roster Ratings ===\n");

  // For each team, use the LATEST available edition (some teams dropped from newer editions)
  const allRazali = await prisma.teamSeasonRazali.findMany({
    include: { team: { select: { id: true, name: true, confederation: true, eloOffensive: true, eloDefensive: true } } },
    orderBy: { fifaEdition: "desc" },
  });

  // Keep only the latest edition per team
  const latestByTeam = new Map<string, typeof allRazali[0]>();
  for (const r of allRazali) {
    if (!latestByTeam.has(r.teamId)) {
      latestByTeam.set(r.teamId, r);
    }
  }
  const razaliData = [...latestByTeam.values()];

  console.log(`Found ${razaliData.length} teams with Razali data (using latest available edition per team)\n`);

  let updated = 0;
  for (const r of razaliData) {
    const combined = combinedRating(
      r.team.eloOffensive,
      r.team.eloDefensive,
      r.razaliOffensive,
      r.razaliDefensive,
      r.team.confederation
    );

    await prisma.team.update({
      where: { id: r.team.id },
      data: {
        rosterOffensive: r.razaliOffensive,
        rosterDefensive: r.razaliDefensive,
        currentOffensiveRating: combined.offensive,
        currentDefensiveRating: combined.defensive,
        currentOverallRating: combined.overall,
      },
    });
    updated++;
  }

  // Re-rank all teams
  console.log("Re-ranking teams...");
  const ranked = await prisma.team.findMany({
    where: { currentRank: { gt: 0 } },
    orderBy: { currentOverallRating: "desc" },
  });
  for (let i = 0; i < ranked.length; i++) {
    await prisma.team.update({
      where: { id: ranked[i].id },
      data: { currentRank: i + 1 },
    });
  }

  // Print top 20
  console.log("\n=== Rankings with Razali Roster (50/50 Elo + Razali) ===\n");
  console.log("Rank  Team                     Overall  Elo    Razali   HA");
  console.log("----  ----                     -------  -----  ------  ----");
  for (let i = 0; i < Math.min(20, ranked.length); i++) {
    const t = ranked[i];
    const eloOvr = (t.eloOffensive + (3000 - t.eloDefensive)) / 2;
    const razOvr = (t.rosterOffensive + (3000 - t.rosterDefensive)) / 2;
    console.log(
      `${String(i + 1).padStart(4)}  ${t.name.padEnd(25)} ${t.currentOverallRating.toFixed(0).padStart(7)}  ${eloOvr.toFixed(0).padStart(5)}  ${razOvr.toFixed(0).padStart(6)}  ${t.homeAdvantage.toFixed(2)}`
    );
  }

  console.log(`\nTeams with Razali data: ${updated}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Roster application failed:", err);
  process.exit(1);
});
