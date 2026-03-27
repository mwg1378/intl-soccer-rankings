/**
 * Derive data-driven confederation strength penalties from
 * cross-confederation match results (2014-present).
 *
 * For each confederation, computes how much their Elo ratings
 * overpredict performance against teams from other confederations.
 * The penalty = average Elo overperformance (inflated ratings).
 *
 * Usage: npx tsx scripts/derive-confederation-penalties.ts
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const url = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL!);
const pool = new pg.Pool({
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  host: url.hostname,
  port: parseInt(url.port || "5432"),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  max: 2,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // Load all matches with pre-match Elo ratings where teams are from different confederations
  const matches = await prisma.match.findMany({
    where: {
      homeEloOffBefore: { not: null },
      awayEloOffBefore: { not: null },
      date: { gte: new Date("2014-01-01") },
      matchImportance: { in: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT", "QUALIFIER"] },
    },
    include: {
      homeTeam: { select: { name: true, confederation: true } },
      awayTeam: { select: { name: true, confederation: true } },
    },
    orderBy: { date: "asc" },
  });

  console.log(`Total matches: ${matches.length}`);

  // Filter to cross-confederation matches only
  const crossMatches = matches.filter(
    m => m.homeTeam.confederation !== m.awayTeam.confederation
  );
  console.log(`Cross-confederation matches: ${crossMatches.length}\n`);

  // For each match, compute expected W based on raw Elo, then compare to actual
  const confStats: Record<string, { totalExpectedW: number; totalActualW: number; count: number }> = {};

  for (const m of crossMatches) {
    const homeOff = m.homeEloOffBefore!;
    const homeDef = m.homeEloDefBefore!;
    const awayOff = m.awayEloOffBefore!;
    const awayDef = m.awayEloDefBefore!;

    const homeOverall = (homeOff + (3000 - homeDef)) / 2;
    const awayOverall = (awayOff + (3000 - awayDef)) / 2;

    // Expected result using Elo formula (600-point scale)
    const dr = homeOverall - awayOverall;
    const homeExpectedW = 1 / (Math.pow(10, -dr / 600) + 1);

    // Actual result
    let homeActualW: number;
    if (m.homeScore > m.awayScore) homeActualW = 1;
    else if (m.homeScore < m.awayScore) homeActualW = 0;
    else homeActualW = 0.5;

    // Track for home team's confederation
    const hConf = m.homeTeam.confederation;
    if (!confStats[hConf]) confStats[hConf] = { totalExpectedW: 0, totalActualW: 0, count: 0 };
    confStats[hConf].totalExpectedW += homeExpectedW;
    confStats[hConf].totalActualW += homeActualW;
    confStats[hConf].count++;

    // Track for away team's confederation (inverted)
    const aConf = m.awayTeam.confederation;
    if (!confStats[aConf]) confStats[aConf] = { totalExpectedW: 0, totalActualW: 0, count: 0 };
    confStats[aConf].totalExpectedW += (1 - homeExpectedW);
    confStats[aConf].totalActualW += (1 - homeActualW);
    confStats[aConf].count++;
  }

  // Compute over/under performance per confederation
  console.log("Confederation Cross-Match Performance (2014-present):");
  console.log("=".repeat(75));
  console.log(`${"Conf".padEnd(12)} ${"Matches".padStart(8)} ${"Exp W%".padStart(8)} ${"Act W%".padStart(8)} ${"Diff".padStart(8)} ${"Penalty".padStart(10)}`);
  console.log("-".repeat(75));

  const confOrder = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];
  const penalties: Record<string, number> = {};

  // Use UEFA as baseline (0 penalty)
  let uefaOverPerf = 0;

  for (const conf of confOrder) {
    const s = confStats[conf];
    if (!s || s.count === 0) {
      penalties[conf] = 0;
      continue;
    }

    const expectedWPct = s.totalExpectedW / s.count;
    const actualWPct = s.totalActualW / s.count;
    const diff = actualWPct - expectedWPct;

    // Convert the win rate difference to Elo points
    // If a conf underperforms by X%, that's roughly X * 600 / 0.25 Elo points
    // (since dW/dR ≈ 0.25/600 at 50% expected for 600-point scale)
    // Simplified: penalty ≈ diff * 600 / (expectedWPct * (1 - expectedWPct))
    // But more robustly, use the inverse Elo formula:
    // actualW = 1/(10^(-dr/600)+1), solve for dr given actualW and expectedW
    // dr_actual - dr_expected ≈ inflation
    const drFromW = (w: number) => -600 * Math.log10(1 / w - 1);
    const eloDiff = drFromW(Math.max(0.01, Math.min(0.99, actualWPct))) -
                    drFromW(Math.max(0.01, Math.min(0.99, expectedWPct)));

    if (conf === "UEFA") uefaOverPerf = eloDiff;

    console.log(
      `${conf.padEnd(12)} ${String(s.count).padStart(8)} ${(expectedWPct * 100).toFixed(1).padStart(7)}% ${(actualWPct * 100).toFixed(1).padStart(7)}% ${(diff * 100).toFixed(1).padStart(7)}% ${eloDiff.toFixed(0).padStart(9)}`
    );
  }

  // Compute penalties relative to UEFA (baseline = 0)
  console.log("\n=== Recommended Penalties (relative to UEFA) ===\n");
  for (const conf of confOrder) {
    const s = confStats[conf];
    if (!s || s.count === 0) {
      penalties[conf] = conf === "OFC" ? 50 : 0;
      continue;
    }

    const expectedWPct = s.totalExpectedW / s.count;
    const actualWPct = s.totalActualW / s.count;
    const drFromW = (w: number) => -600 * Math.log10(1 / w - 1);
    const eloDiff = drFromW(Math.max(0.01, Math.min(0.99, actualWPct))) -
                    drFromW(Math.max(0.01, Math.min(0.99, expectedWPct)));

    const relativeToUefa = uefaOverPerf - eloDiff;
    // Round to nearest 5
    penalties[conf] = Math.round(Math.max(0, relativeToUefa) / 5) * 5;
    console.log(`  ${conf}: ${penalties[conf]} (raw: ${relativeToUefa.toFixed(1)})`);
  }

  console.log("\n// Suggested code:");
  console.log("const CONFEDERATION_PENALTY: Record<string, number> = {");
  for (const conf of confOrder) {
    console.log(`  ${conf}: ${penalties[conf]},`);
  }
  console.log("};");

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
