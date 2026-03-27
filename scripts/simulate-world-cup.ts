/**
 * Run the World Cup 2026 Monte Carlo simulation and store results in the DB.
 *
 * Usage: npx tsx scripts/simulate-world-cup.ts [iterations]
 * Default: 100000 iterations (always use 100K for production runs)
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { runSimulation, setRatingStats } from "../lib/world-cup-simulator";
import {
  CONFIRMED_TEAMS,
  PLAYOFF_TEAMS,
  dbName,
} from "../lib/world-cup-data";

// --- Initialize Prisma ---
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
  const iterations = parseInt(process.argv[2] ?? "100000", 10);
  console.log(`=== World Cup 2026 Monte Carlo Simulation ===`);
  console.log(`Iterations: ${iterations}\n`);

  // Load all team ratings from DB
  console.log("1. Loading team ratings from database...");
  const allTeamNames = [...CONFIRMED_TEAMS, ...PLAYOFF_TEAMS].map(dbName);
  const uniqueNames = [...new Set(allTeamNames)];

  const teams = await prisma.team.findMany({
    where: { name: { in: uniqueNames } },
  });

  console.log(`   Found ${teams.length}/${uniqueNames.length} teams in DB`);

  // Check for missing teams
  const foundNames = new Set(teams.map((t) => t.name));
  const missing = uniqueNames.filter((n) => !foundNames.has(n));
  if (missing.length > 0) {
    console.warn(`   WARNING: Missing teams: ${missing.join(", ")}`);
  }

  // Use Grid-Optimized ratings (70% Combined + 30% BT) — best market alignment
  // (MSE=0.000274 vs sportsbook odds, Spearman r=0.907, 100% top-5 overlap).
  console.log(`   Using Grid-Optimized ratings (70% Combined + 30% BT)`);

  // Compute rating stats from grid-optimized ratings
  const allRankedTeams = await prisma.team.findMany({
    where: { gridOptRank: { gt: 0 } },
    select: { gridOptOff: true, gridOptDef: true },
  });
  const n = allRankedTeams.length;
  const avgOff = allRankedTeams.reduce((s, t) => s + t.gridOptOff, 0) / n;
  const avgDef = allRankedTeams.reduce((s, t) => s + t.gridOptDef, 0) / n;
  const stdOff = Math.sqrt(allRankedTeams.reduce((s, t) => s + (t.gridOptOff - avgOff) ** 2, 0) / n);
  const stdDef = Math.sqrt(allRankedTeams.reduce((s, t) => s + (t.gridOptDef - avgDef) ** 2, 0) / n);
  console.log(`   Rating stats: avgOff=${avgOff.toFixed(1)}, avgDef=${avgDef.toFixed(1)}, stdOff=${stdOff.toFixed(1)}, stdDef=${stdDef.toFixed(1)}`);
  setRatingStats({ avgOff, avgDef, stdOff, stdDef });

  // Build team data map using Grid-Optimized ratings + per-team home advantage
  const teamDataMap = new Map<string, {
    name: string;
    dbName: string;
    slug: string;
    ratings: { offensive: number; defensive: number };
    homeAdvantage?: number;
  }>();

  for (const t of teams) {
    teamDataMap.set(t.name, {
      name: t.name,
      dbName: t.name,
      slug: t.slug,
      ratings: {
        offensive: t.gridOptOff,
        defensive: t.gridOptDef,
      },
      homeAdvantage: t.homeAdvantage,
    });
  }

  // For any missing teams, use default ratings
  for (const name of uniqueNames) {
    if (!teamDataMap.has(name)) {
      console.warn(`   Using default ratings for: ${name}`);
      teamDataMap.set(name, {
        name,
        dbName: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        ratings: { offensive: avgOff, defensive: avgDef },
      });
    }
  }

  // 2. Run simulation
  console.log("\n2. Running simulation...");
  const startTime = Date.now();
  const results = runSimulation(teamDataMap, iterations);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   Simulation complete in ${elapsed}s\n`);

  // 3. Print key results
  console.log("=== Qualifier Odds ===");
  for (const [pathId, odds] of Object.entries(results.qualifierOdds)) {
    console.log(`\n${odds.description}:`);
    const sorted = Object.entries(odds.teams).sort((a, b) => b[1] - a[1]);
    for (const [name, prob] of sorted) {
      console.log(`  ${name.padEnd(25)} ${(prob * 100).toFixed(1)}%`);
    }
  }

  console.log("\n=== Top 10 Championship Odds ===");
  const champOdds = Object.entries(results.advancementOdds)
    .sort((a, b) => b[1].probChampion - a[1].probChampion)
    .slice(0, 10);
  for (const [slug, odds] of champOdds) {
    console.log(
      `  ${odds.name.padEnd(25)} ${(odds.probChampion * 100).toFixed(1)}% champion | ${(odds.probFinal * 100).toFixed(1)}% final | ${(odds.probR32 * 100).toFixed(1)}% R32`
    );
  }

  // 4. Store in database
  console.log("\n3. Storing results in database...");

  // Delete old simulations
  await prisma.worldCupSimulation.deleteMany();

  await prisma.worldCupSimulation.create({
    data: {
      iterations,
      groupOdds: results.groupOdds,
      bracketOdds: results.bracketOdds,
      advancementOdds: results.advancementOdds,
      qualifierOdds: results.qualifierOdds,
    },
  });

  console.log("   Stored simulation results\n");
  console.log("=== Done! ===");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
