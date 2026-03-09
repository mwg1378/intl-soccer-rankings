/**
 * Backtest the prediction engine against historical tournament results.
 *
 * Uses pre-match Elo ratings stored on each match to predict outcomes,
 * then compares against actual results.
 *
 * Usage: npx tsx scripts/backtest-predictions.ts
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

interface BacktestMatch {
  id: string;
  date: Date;
  tournament: string;
  tournamentStage: string | null;
  homeScore: number;
  awayScore: number;
  neutralVenue: boolean;
  matchImportance: string;
  homeEloOffBefore: number | null;
  homeEloDefBefore: number | null;
  awayEloOffBefore: number | null;
  awayEloDefBefore: number | null;
  homeTeam: { name: string; fifaCode: string };
  awayTeam: { name: string; fifaCode: string };
}

interface TournamentStats {
  name: string;
  matches: number;
  correctOutcome: number;
  correctResult: number;
  brierScore: number;
  logLoss: number;
  // Calibration bins: predicted prob range → { count, actual wins }
  calibration: Map<string, { count: number; actualWins: number }>;
  // Per-match details for spot-checking
  details: Array<{
    home: string;
    away: string;
    actual: string;
    predicted: string;
    homeWinP: number;
    drawP: number;
    awayWinP: number;
    homeXG: number;
    awayXG: number;
    correct: boolean;
  }>;
}

async function main() {
  console.log("=== Prediction Engine Backtest ===\n");

  // Load tournament matches with pre-match Elo ratings
  const tournaments = [
    // World Cups
    { name: "FIFA World Cup 2022", pattern: "%World Cup%", year: 2022, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    { name: "FIFA World Cup 2018", pattern: "%World Cup%", year: 2018, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    { name: "FIFA World Cup 2014", pattern: "%World Cup%", year: 2014, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    // Continental tournaments
    { name: "Euro 2024", pattern: "%Euro%", year: 2024, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    { name: "Euro 2020/21", pattern: "%Euro%", year: 2021, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    { name: "Copa America 2024", pattern: "%Copa Am%", year: 2024, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    { name: "Copa America 2021", pattern: "%Copa Am%", year: 2021, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    { name: "Africa Cup 2023/24", pattern: "%Africa%", year: 2024, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
    { name: "Asia Cup 2023/24", pattern: "%Asian Cup%", year: 2024, importance: ["TOURNAMENT_GROUP", "TOURNAMENT_KNOCKOUT"] },
  ];

  // Compute global rating stats for z-score normalization
  // Use all ranked teams' current Elo as a reasonable approximation
  const allTeams = await prisma.team.findMany({
    where: { currentRank: { gt: 0 } },
    select: { eloOffensive: true, eloDefensive: true },
  });
  const nTeams = allTeams.length;
  const globalAvgOff = allTeams.reduce((s, t) => s + t.eloOffensive, 0) / nTeams;
  const globalAvgDef = allTeams.reduce((s, t) => s + t.eloDefensive, 0) / nTeams;
  const globalStdOff = Math.sqrt(allTeams.reduce((s, t) => s + (t.eloOffensive - globalAvgOff) ** 2, 0) / nTeams);
  const globalStdDef = Math.sqrt(allTeams.reduce((s, t) => s + (t.eloDefensive - globalAvgDef) ** 2, 0) / nTeams);
  console.log(`Global rating stats: avgOff=${globalAvgOff.toFixed(1)}, avgDef=${globalAvgDef.toFixed(1)}, stdOff=${globalStdOff.toFixed(1)}, stdDef=${globalStdDef.toFixed(1)}\n`);

  const allStats: TournamentStats[] = [];

  for (const tourney of tournaments) {
    const startDate = new Date(`${tourney.year}-01-01`);
    const endDate = new Date(`${tourney.year}-12-31`);

    const matches = await prisma.match.findMany({
      where: {
        tournament: { contains: tourney.pattern.replace(/%/g, "") },
        date: { gte: startDate, lte: endDate },
        matchImportance: { in: tourney.importance as any },
        homeEloOffBefore: { not: null },
        awayEloOffBefore: { not: null },
      },
      include: {
        homeTeam: { select: { name: true, fifaCode: true } },
        awayTeam: { select: { name: true, fifaCode: true } },
      },
      orderBy: { date: "asc" },
    }) as unknown as BacktestMatch[];

    if (matches.length === 0) continue;

    // Compute tournament-specific rating stats from pre-match Elo values
    const tourneyRatings = matches.flatMap((m) => [
      { off: m.homeEloOffBefore!, def: m.homeEloDefBefore! },
      { off: m.awayEloOffBefore!, def: m.awayEloDefBefore! },
    ]);
    const tN = tourneyRatings.length;
    const tAvgOff = tourneyRatings.reduce((s, r) => s + r.off, 0) / tN;
    const tAvgDef = tourneyRatings.reduce((s, r) => s + r.def, 0) / tN;
    const tStdOff = Math.sqrt(tourneyRatings.reduce((s, r) => s + (r.off - tAvgOff) ** 2, 0) / tN);
    const tStdDef = Math.sqrt(tourneyRatings.reduce((s, r) => s + (r.def - tAvgDef) ** 2, 0) / tN);

    const stats: TournamentStats = {
      name: tourney.name,
      matches: matches.length,
      correctOutcome: 0,
      correctResult: 0,
      brierScore: 0,
      logLoss: 0,
      calibration: new Map(),
      details: [],
    };

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
        avgOffensive: tAvgOff,
        avgDefensive: tAvgDef,
        stdOffensive: tStdOff,
        stdDefensive: tStdDef,
      });

      // Determine actual outcome
      const actualOutcome =
        match.homeScore > match.awayScore ? "H" :
        match.homeScore < match.awayScore ? "A" : "D";

      // Determine predicted outcome (highest probability)
      const maxProb = Math.max(pred.homeWinProb, pred.drawProb, pred.awayWinProb);
      const predictedOutcome =
        maxProb === pred.homeWinProb ? "H" :
        maxProb === pred.awayWinProb ? "A" : "D";

      const correct = actualOutcome === predictedOutcome;
      if (correct) stats.correctOutcome++;

      // Check if exact scoreline was the most likely
      const topScore = pred.topScorelines[0];
      if (topScore.homeGoals === match.homeScore && topScore.awayGoals === match.awayScore) {
        stats.correctResult++;
      }

      // Brier score: (predicted_prob - actual)^2 for each outcome
      const actualH = actualOutcome === "H" ? 1 : 0;
      const actualD = actualOutcome === "D" ? 1 : 0;
      const actualA = actualOutcome === "A" ? 1 : 0;
      stats.brierScore +=
        (pred.homeWinProb - actualH) ** 2 +
        (pred.drawProb - actualD) ** 2 +
        (pred.awayWinProb - actualA) ** 2;

      // Log loss
      const eps = 0.001;
      const pActual =
        actualOutcome === "H" ? Math.max(pred.homeWinProb, eps) :
        actualOutcome === "A" ? Math.max(pred.awayWinProb, eps) :
        Math.max(pred.drawProb, eps);
      stats.logLoss -= Math.log(pActual);

      // Calibration: bin the predicted probability of the actual outcome
      const favProb = Math.max(pred.homeWinProb, pred.drawProb, pred.awayWinProb);
      const bin = getBin(favProb);
      const cal = stats.calibration.get(bin) ?? { count: 0, actualWins: 0 };
      cal.count++;
      if (correct) cal.actualWins++;
      stats.calibration.set(bin, cal);

      stats.details.push({
        home: match.homeTeam.fifaCode,
        away: match.awayTeam.fifaCode,
        actual: `${match.homeScore}-${match.awayScore} (${actualOutcome})`,
        predicted: predictedOutcome,
        homeWinP: pred.homeWinProb,
        drawP: pred.drawProb,
        awayWinP: pred.awayWinProb,
        homeXG: pred.homeExpectedGoals,
        awayXG: pred.awayExpectedGoals,
        correct,
      });
    }

    stats.brierScore /= stats.matches;
    stats.logLoss /= stats.matches;
    allStats.push(stats);
  }

  // Print results
  console.log("=".repeat(90));
  console.log("TOURNAMENT SUMMARY");
  console.log("=".repeat(90));
  console.log(
    `${"Tournament".padEnd(25)} ${"N".padStart(4)} ${"Acc%".padStart(6)} ${"Brier".padStart(7)} ${"LogLoss".padStart(8)} ${"ExactScr".padStart(8)}`
  );
  console.log("-".repeat(90));

  let totalMatches = 0;
  let totalCorrect = 0;
  let totalBrier = 0;
  let totalLogLoss = 0;

  for (const s of allStats) {
    const acc = (s.correctOutcome / s.matches * 100).toFixed(1);
    const exact = (s.correctResult / s.matches * 100).toFixed(1);
    console.log(
      `${s.name.padEnd(25)} ${String(s.matches).padStart(4)} ${acc.padStart(6)}% ${s.brierScore.toFixed(4).padStart(7)} ${s.logLoss.toFixed(4).padStart(8)} ${exact.padStart(7)}%`
    );
    totalMatches += s.matches;
    totalCorrect += s.correctOutcome;
    totalBrier += s.brierScore * s.matches;
    totalLogLoss += s.logLoss * s.matches;
  }

  console.log("-".repeat(90));
  if (totalMatches > 0) {
    console.log(
      `${"OVERALL".padEnd(25)} ${String(totalMatches).padStart(4)} ${(totalCorrect / totalMatches * 100).toFixed(1).padStart(6)}% ${(totalBrier / totalMatches).toFixed(4).padStart(7)} ${(totalLogLoss / totalMatches).toFixed(4).padStart(8)}`
    );
  }

  // Print calibration
  console.log("\n" + "=".repeat(60));
  console.log("CALIBRATION (predicted favorite probability vs. actual win rate)");
  console.log("=".repeat(60));
  const globalCal = new Map<string, { count: number; actualWins: number }>();
  for (const s of allStats) {
    for (const [bin, data] of s.calibration) {
      const g = globalCal.get(bin) ?? { count: 0, actualWins: 0 };
      g.count += data.count;
      g.actualWins += data.actualWins;
      globalCal.set(bin, g);
    }
  }
  const bins = [...globalCal.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`${"Predicted".padEnd(15)} ${"N".padStart(5)} ${"Actual%".padStart(8)}`);
  for (const [bin, data] of bins) {
    const actualPct = (data.actualWins / data.count * 100).toFixed(1);
    console.log(`${bin.padEnd(15)} ${String(data.count).padStart(5)} ${actualPct.padStart(7)}%`);
  }

  // Print notable misses/hits from biggest tournaments
  for (const s of allStats) {
    if (!s.name.includes("World Cup 2022") && !s.name.includes("Euro 2024")) continue;
    console.log(`\n--- ${s.name} Match Details ---`);
    console.log(
      `${"Match".padEnd(15)} ${"Result".padEnd(12)} ${"Pred".padEnd(5)} ${"H%".padStart(6)} ${"D%".padStart(6)} ${"A%".padStart(6)} ${"xG".padStart(10)} ${"".padStart(3)}`
    );
    for (const d of s.details) {
      const mark = d.correct ? "OK" : "X";
      const xg = `${d.homeXG.toFixed(1)}-${d.awayXG.toFixed(1)}`;
      console.log(
        `${(d.home + " v " + d.away).padEnd(15)} ${d.actual.padEnd(12)} ${d.predicted.padEnd(5)} ${(d.homeWinP * 100).toFixed(1).padStart(5)}% ${(d.drawP * 100).toFixed(1).padStart(5)}% ${(d.awayWinP * 100).toFixed(1).padStart(5)}% ${xg.padStart(10)} ${mark.padStart(3)}`
      );
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

function getBin(prob: number): string {
  if (prob < 0.35) return "< 35%";
  if (prob < 0.45) return "35-45%";
  if (prob < 0.55) return "45-55%";
  if (prob < 0.65) return "55-65%";
  if (prob < 0.75) return "65-75%";
  return "75%+";
}

main().catch((err) => {
  console.error("Backtest failed:", err);
  process.exit(1);
});
