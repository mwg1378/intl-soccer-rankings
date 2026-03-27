/**
 * Run walk-forward backtests for specific historical tournaments and store
 * results in the database for display on the /backtests page.
 *
 * For each tournament, this script:
 *  1. Loads pre-tournament ranking snapshots (closest month before kickoff)
 *  2. Loads all tournament matches with pre-match Elo ratings
 *  3. Runs predictions using the prediction engine
 *  4. Computes aggregate metrics (Brier, accuracy, log loss)
 *  5. Stores everything in the TournamentBacktest table
 *
 * No lookahead bias: predictions use only data available before each match.
 *
 * Usage: npx tsx scripts/backtest-tournaments.ts
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { predictMatch } from "../lib/prediction-engine";

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

// --- Tournament definitions ---
const TOURNAMENTS = [
  {
    slug: "world-cup-2022",
    name: "FIFA World Cup 2022",
    tournamentPattern: "World Cup",
    startDate: new Date("2022-11-20"),
    endDate: new Date("2022-12-18"),
    snapshotDate: new Date("2022-10-31"), // pre-tournament snapshot
  },
  {
    slug: "euro-2024",
    name: "UEFA Euro 2024",
    tournamentPattern: "Euro",
    startDate: new Date("2024-06-14"),
    endDate: new Date("2024-07-14"),
    snapshotDate: new Date("2024-05-31"),
  },
  {
    slug: "copa-america-2024",
    name: "Copa América 2024",
    tournamentPattern: "Copa Am",
    startDate: new Date("2024-06-20"),
    endDate: new Date("2024-07-14"),
    snapshotDate: new Date("2024-05-31"),
  },
];

async function main() {
  console.log("=== Tournament Backtest Generator ===\n");

  for (const tourney of TOURNAMENTS) {
    console.log(`\n--- ${tourney.name} ---`);

    // 1. Load pre-tournament ranking snapshots
    console.log("  Loading pre-tournament rankings...");
    const snapshots = await prisma.rankingSnapshot.findMany({
      where: {
        date: { lte: tourney.snapshotDate },
      },
      orderBy: [{ date: "desc" }, { rank: "asc" }],
      include: {
        team: { select: { name: true, slug: true, fifaCode: true, confederation: true } },
      },
    });

    // Get the latest snapshot date
    const latestSnapshotDate = snapshots.length > 0 ? snapshots[0].date : null;
    if (!latestSnapshotDate) {
      console.log(`  No snapshots found before ${tourney.snapshotDate.toISOString().slice(0, 10)}. Skipping.`);
      continue;
    }

    // Filter to only snapshots from the latest date
    const preRankings = snapshots
      .filter(s => s.date.getTime() === latestSnapshotDate.getTime())
      .map(s => ({
        rank: s.rank,
        team: s.team.name,
        slug: s.team.slug,
        fifaCode: s.team.fifaCode,
        confederation: s.team.confederation,
        overall: s.overallRating,
        offensive: s.offensiveRating,
        defensive: s.defensiveRating,
        eloOff: s.eloOffensive,
        eloDef: s.eloDefensive,
        btRating: s.btRating,
        btRank: s.btRank,
        glickoRating: s.glickoRating,
        glickoRank: s.glickoRank,
        berrarRating: s.berrarRating,
        berrarRank: s.berrarRank,
        opRating: s.opRating,
        opRank: s.opRank,
        iwPiOverall: s.iwPiOverall,
        iwPiRank: s.iwPiRank,
        moEloOverall: s.moEloOverall,
        moEloRank: s.moEloRank,
      }))
      .sort((a, b) => a.rank - b.rank);

    console.log(`  Found ${preRankings.length} teams in snapshot from ${latestSnapshotDate.toISOString().slice(0, 10)}`);

    // 2. Load tournament matches with pre-match Elo ratings
    console.log("  Loading tournament matches...");
    const matches = await prisma.match.findMany({
      where: {
        tournament: { contains: tourney.tournamentPattern },
        date: { gte: tourney.startDate, lte: tourney.endDate },
        matchImportance: { in: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
        homeEloOffBefore: { not: null },
        awayEloOffBefore: { not: null },
      },
      include: {
        homeTeam: { select: { name: true, slug: true, fifaCode: true } },
        awayTeam: { select: { name: true, slug: true, fifaCode: true } },
      },
      orderBy: { date: "asc" },
    });

    if (matches.length === 0) {
      console.log(`  No matches found for ${tourney.name}. Skipping.`);
      continue;
    }

    console.log(`  Found ${matches.length} matches`);

    // 3. Compute rating stats from pre-match Elo values for z-score normalization
    const tourneyRatings = matches.flatMap(m => [
      { off: m.homeEloOffBefore!, def: m.homeEloDefBefore! },
      { off: m.awayEloOffBefore!, def: m.awayEloDefBefore! },
    ]);
    const tN = tourneyRatings.length;
    const avgOff = tourneyRatings.reduce((s, r) => s + r.off, 0) / tN;
    const avgDef = tourneyRatings.reduce((s, r) => s + r.def, 0) / tN;
    const stdOff = Math.sqrt(tourneyRatings.reduce((s, r) => s + (r.off - avgOff) ** 2, 0) / tN);
    const stdDef = Math.sqrt(tourneyRatings.reduce((s, r) => s + (r.def - avgDef) ** 2, 0) / tN);

    // 4. Run predictions and compute metrics
    let correctOutcome = 0;
    let totalBrier = 0;
    let totalLogLoss = 0;
    const matchResults: Array<{
      date: string;
      home: string;
      homeCode: string;
      homeSlug: string;
      away: string;
      awayCode: string;
      awaySlug: string;
      stage: string;
      homeScore: number;
      awayScore: number;
      actualOutcome: string;
      predictedOutcome: string;
      homeWinProb: number;
      drawProb: number;
      awayWinProb: number;
      homeXg: number;
      awayXg: number;
      correct: boolean;
      brier: number;
      topScorelines: Array<{ home: number; away: number; prob: number }>;
    }> = [];

    for (const match of matches) {
      const pred = predictMatch({
        homeTeam: {
          offensive: match.homeEloOffBefore!,
          defensive: match.homeEloDefBefore!,
        },
        awayTeam: {
          offensive: match.awayEloOffBefore!,
          defensive: match.awayEloDefBefore!,
        },
        neutralVenue: match.neutralVenue,
        matchImportance: match.matchImportance as any,
        avgOffensive: avgOff,
        avgDefensive: avgDef,
        stdOffensive: stdOff,
        stdDefensive: stdDef,
      });

      const actualOutcome =
        match.homeScore > match.awayScore ? "H" :
        match.homeScore < match.awayScore ? "A" : "D";

      const maxProb = Math.max(pred.homeWinProb, pred.drawProb, pred.awayWinProb);
      const predictedOutcome =
        maxProb === pred.homeWinProb ? "H" :
        maxProb === pred.awayWinProb ? "A" : "D";

      const correct = actualOutcome === predictedOutcome;
      if (correct) correctOutcome++;

      // Brier score for this match
      const actualH = actualOutcome === "H" ? 1 : 0;
      const actualD = actualOutcome === "D" ? 1 : 0;
      const actualA = actualOutcome === "A" ? 1 : 0;
      const brier =
        (pred.homeWinProb - actualH) ** 2 +
        (pred.drawProb - actualD) ** 2 +
        (pred.awayWinProb - actualA) ** 2;
      totalBrier += brier;

      // Log loss
      const eps = 0.001;
      const pActual =
        actualOutcome === "H" ? Math.max(pred.homeWinProb, eps) :
        actualOutcome === "A" ? Math.max(pred.awayWinProb, eps) :
        Math.max(pred.drawProb, eps);
      totalLogLoss -= Math.log(pActual);

      matchResults.push({
        date: match.date.toISOString().slice(0, 10),
        home: match.homeTeam.name,
        homeCode: match.homeTeam.fifaCode,
        homeSlug: match.homeTeam.slug,
        away: match.awayTeam.name,
        awayCode: match.awayTeam.fifaCode,
        awaySlug: match.awayTeam.slug,
        stage: match.matchImportance,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        actualOutcome,
        predictedOutcome,
        homeWinProb: Math.round(pred.homeWinProb * 1000) / 1000,
        drawProb: Math.round(pred.drawProb * 1000) / 1000,
        awayWinProb: Math.round(pred.awayWinProb * 1000) / 1000,
        homeXg: Math.round(pred.homeExpectedGoals * 100) / 100,
        awayXg: Math.round(pred.awayExpectedGoals * 100) / 100,
        correct,
        brier: Math.round(brier * 10000) / 10000,
        topScorelines: pred.topScorelines.slice(0, 3).map(s => ({
          home: s.homeGoals,
          away: s.awayGoals,
          prob: Math.round(s.probability * 1000) / 1000,
        })),
      });
    }

    const avgBrier = totalBrier / matches.length;
    const avgLogLoss = totalLogLoss / matches.length;
    const accuracy = correctOutcome / matches.length;

    console.log(`  Results: ${correctOutcome}/${matches.length} correct (${(accuracy * 100).toFixed(1)}%)`);
    console.log(`  Brier: ${avgBrier.toFixed(4)}, Log Loss: ${avgLogLoss.toFixed(4)}`);

    // 5. Upsert into database
    console.log("  Storing results...");
    await prisma.tournamentBacktest.upsert({
      where: { slug: tourney.slug },
      create: {
        slug: tourney.slug,
        tournament: tourney.name,
        startDate: tourney.startDate,
        endDate: tourney.endDate,
        totalMatches: matches.length,
        correctOutcome,
        brierScore: avgBrier,
        logLoss: avgLogLoss,
        accuracy,
        rankings: preRankings,
        matches: matchResults,
      },
      update: {
        tournament: tourney.name,
        startDate: tourney.startDate,
        endDate: tourney.endDate,
        totalMatches: matches.length,
        correctOutcome,
        brierScore: avgBrier,
        logLoss: avgLogLoss,
        accuracy,
        rankings: preRankings,
        matches: matchResults,
      },
    });

    console.log(`  Stored ${tourney.name} backtest (${matches.length} matches, ${preRankings.length} ranked teams)`);
  }

  console.log("\n=== Done! ===");
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Backtest failed:", err);
  process.exit(1);
});
