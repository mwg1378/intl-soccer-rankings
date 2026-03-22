/**
 * Derive empirical scoreline-to-W mapping for the Bradley-Terry engine.
 *
 * Approach:
 *  1. For each match with scoreline S where team A beat team B,
 *     find the next rematch between A and B within 2 years.
 *  2. Compute the fraction of rematches won by the original winner.
 *  3. Map this to a W value per scoreline (goal diff + total goals).
 *  4. Fit a smooth sigmoid: W = sigmoid(α * goalDiff + β * totalGoals + γ)
 *     to ensure monotonicity and handle sparse scorelines.
 *  5. Output a hardcoded lookup table.
 *
 * Usage: npx tsx scripts/derive-scoreline-map.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

interface Match {
  date: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

// --- Load and parse CSV ---
const csvPath = join(__dirname, "data", "results.csv");
const lines = readFileSync(csvPath, "utf-8").split("\n");
const header = lines[0].split(",");
const dateIdx = header.indexOf("date");
const homeIdx = header.indexOf("home_team");
const awayIdx = header.indexOf("away_team");
const hsIdx = header.indexOf("home_score");
const asIdx = header.indexOf("away_score");

const matches: Match[] = lines
  .slice(1)
  .filter((l) => l.trim())
  .map((line) => {
    const cols = line.split(",");
    return {
      date: new Date(cols[dateIdx]),
      homeTeam: cols[homeIdx],
      awayTeam: cols[awayIdx],
      homeScore: parseInt(cols[hsIdx], 10),
      awayScore: parseInt(cols[asIdx], 10),
    };
  })
  .filter((m) => !isNaN(m.homeScore) && !isNaN(m.awayScore))
  .sort((a, b) => a.date.getTime() - b.date.getTime());

console.log(`Loaded ${matches.length} matches`);

// --- Build pair index for fast rematch lookup ---
// Key: "teamA|teamB" (sorted alphabetically) → list of {date, winnerIsFirst}
type PairKey = string;
interface PairMatch {
  date: Date;
  winner: string | null; // null = draw
  homeScore: number;
  awayScore: number;
}

function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const pairIndex = new Map<PairKey, PairMatch[]>();

for (const m of matches) {
  const key = pairKey(m.homeTeam, m.awayTeam);
  if (!pairIndex.has(key)) pairIndex.set(key, []);

  let winner: string | null = null;
  if (m.homeScore > m.awayScore) winner = m.homeTeam;
  else if (m.awayScore > m.homeScore) winner = m.awayTeam;

  pairIndex.get(key)!.push({
    date: m.date,
    winner,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  });
}

// --- For each decisive match, find rematches within 2 years ---
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;

// Scoreline key from winner's perspective: "goalDiff,totalGoals"
interface ScorelineStats {
  goalDiff: number;
  totalGoals: number;
  rematches: number;
  winnerWonRematch: number;
  winnerDrewRematch: number;
  winnerLostRematch: number;
  occurrences: number; // total matches with this scoreline (even without rematches)
}

const scorelineMap = new Map<string, ScorelineStats>();

function scorelineKey(goalDiff: number, totalGoals: number): string {
  return `${goalDiff},${totalGoals}`;
}

for (const [, pairMatches] of pairIndex) {
  for (let i = 0; i < pairMatches.length; i++) {
    const m = pairMatches[i];
    if (!m.winner) continue; // skip draws

    const goalDiff = Math.abs(m.homeScore - m.awayScore);
    const totalGoals = m.homeScore + m.awayScore;
    const key = scorelineKey(goalDiff, totalGoals);

    if (!scorelineMap.has(key)) {
      scorelineMap.set(key, {
        goalDiff,
        totalGoals,
        rematches: 0,
        winnerWonRematch: 0,
        winnerDrewRematch: 0,
        winnerLostRematch: 0,
        occurrences: 0,
      });
    }
    const stats = scorelineMap.get(key)!;
    stats.occurrences++;

    // Find next rematch within 2 years
    for (let j = i + 1; j < pairMatches.length; j++) {
      const rematch = pairMatches[j];
      const gap = rematch.date.getTime() - m.date.getTime();
      if (gap > TWO_YEARS_MS) break;

      stats.rematches++;
      if (rematch.winner === m.winner) stats.winnerWonRematch++;
      else if (rematch.winner === null) stats.winnerDrewRematch++;
      else stats.winnerLostRematch++;
      break; // only take the NEXT rematch
    }
  }
}

// --- Compute empirical W for each scoreline ---
interface EmpiricalPoint {
  goalDiff: number;
  totalGoals: number;
  empiricalW: number;
  rematches: number;
  occurrences: number;
}

const empiricalPoints: EmpiricalPoint[] = [];

console.log("\n--- Empirical scoreline data (min 30 rematches) ---");
console.log(
  "GoalDiff  TotalGoals  Rematches  Occurrences  WinnerWon  Drew  Lost  EmpiricalW"
);

const sortedKeys = [...scorelineMap.entries()].sort((a, b) => {
  if (a[1].goalDiff !== b[1].goalDiff) return a[1].goalDiff - b[1].goalDiff;
  return a[1].totalGoals - b[1].totalGoals;
});

for (const [, stats] of sortedKeys) {
  if (stats.rematches < 10) continue;

  // W = fraction of rematches where the original winner won or drew (weighted)
  // Using: win = 1, draw = 0.5, loss = 0
  const empiricalW =
    (stats.winnerWonRematch + stats.winnerDrewRematch * 0.5) / stats.rematches;

  empiricalPoints.push({
    goalDiff: stats.goalDiff,
    totalGoals: stats.totalGoals,
    empiricalW,
    rematches: stats.rematches,
    occurrences: stats.occurrences,
  });

  if (stats.rematches >= 30) {
    console.log(
      `${String(stats.goalDiff).padStart(8)}  ${String(stats.totalGoals).padStart(10)}  ${String(stats.rematches).padStart(9)}  ${String(stats.occurrences).padStart(11)}  ${String(stats.winnerWonRematch).padStart(9)}  ${String(stats.winnerDrewRematch).padStart(4)}  ${String(stats.winnerLostRematch).padStart(4)}  ${empiricalW.toFixed(4)}`
    );
  }
}

// --- Fit sigmoid: W = sigmoid(α * goalDiff + β * totalGoals + γ) ---
// sigmoid(x) = 1 / (1 + exp(-x))
// We want W_home for the WINNER, so W should be > 0.5

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Simple gradient descent to fit α, β, γ
// Loss: weighted sum of squared errors
let alpha = 0.3;
let beta = -0.05;
let gamma = 0.2;
const lr = 0.001;
const iterations = 50000;

for (let iter = 0; iter < iterations; iter++) {
  let dAlpha = 0;
  let dBeta = 0;
  let dGamma = 0;
  let totalWeight = 0;

  for (const p of empiricalPoints) {
    const x = alpha * p.goalDiff + beta * p.totalGoals + gamma;
    const predicted = sigmoid(x);
    const error = predicted - p.empiricalW;
    const weight = p.rematches; // weight by sample size
    const dsigmoid = predicted * (1 - predicted);

    dAlpha += weight * error * dsigmoid * p.goalDiff;
    dBeta += weight * error * dsigmoid * p.totalGoals;
    dGamma += weight * error * dsigmoid;
    totalWeight += weight;
  }

  alpha -= (lr * dAlpha) / totalWeight;
  beta -= (lr * dBeta) / totalWeight;
  gamma -= (lr * dGamma) / totalWeight;
}

console.log(`\n--- Fitted sigmoid parameters ---`);
console.log(`α (goalDiff): ${alpha.toFixed(6)}`);
console.log(`β (totalGoals): ${beta.toFixed(6)}`);
console.log(`γ (intercept): ${gamma.toFixed(6)}`);

// --- Generate lookup table ---
console.log(`\n--- Scoreline W lookup table ---`);
console.log(`(from winner's perspective, W > 0.5 means winner favored)`);
console.log(`\nScoreline  GoalDiff  TotalGoals  FittedW  EmpiricalW  Rematches`);

// Generate common scorelines
const commonScorelines: Array<[number, number]> = [];
for (let h = 0; h <= 8; h++) {
  for (let a = 0; a <= 8; a++) {
    if (h > a) commonScorelines.push([h, a]); // only wins
  }
}

// Sort by goal diff, then total goals
commonScorelines.sort((a, b) => {
  const diffA = a[0] - a[1];
  const diffB = b[0] - b[1];
  if (diffA !== diffB) return diffA - diffB;
  return a[0] + a[1] - (b[0] + b[1]);
});

const lookupTable: Record<string, number> = {};

for (const [h, a] of commonScorelines) {
  const gd = h - a;
  const tg = h + a;
  const x = alpha * gd + beta * tg + gamma;
  const fittedW = sigmoid(x);

  // Find empirical data if available
  const emp = empiricalPoints.find(
    (p) => p.goalDiff === gd && p.totalGoals === tg
  );
  const empStr = emp
    ? `${emp.empiricalW.toFixed(4)}      ${emp.rematches}`
    : "    -          -";

  const scoreKey = `${h}-${a}`;
  lookupTable[scoreKey] = Math.round(fittedW * 10000) / 10000;

  console.log(
    `${scoreKey.padStart(9)}  ${String(gd).padStart(8)}  ${String(tg).padStart(10)}  ${fittedW.toFixed(4)}   ${empStr}`
  );
}

// --- Output as TypeScript constant ---
console.log(`\n--- TypeScript constant for bt-engine.ts ---\n`);
console.log(`// Sigmoid parameters: α=${alpha.toFixed(6)}, β=${beta.toFixed(6)}, γ=${gamma.toFixed(6)}`);
console.log(`// W = sigmoid(α * goalDiff + β * totalGoals + γ)`);
console.log(`// Derived from ${matches.length} historical international matches`);
console.log(`const SCORELINE_SIGMOID = { alpha: ${alpha.toFixed(6)}, beta: ${beta.toFixed(6)}, gamma: ${gamma.toFixed(6)} };`);
console.log(`\nconst SCORELINE_W: Record<string, number> = {`);

for (const [key, val] of Object.entries(lookupTable)) {
  console.log(`  "${key}": ${val},`);
}
console.log(`};`);

// --- Verify monotonicity ---
console.log(`\n--- Monotonicity checks ---`);
const checks = [
  ["1-0 > 2-1", lookupTable["1-0"], lookupTable["2-1"]],
  ["2-1 > 3-2", lookupTable["2-1"], lookupTable["3-2"]],
  ["3-2 > 4-3", lookupTable["3-2"], lookupTable["4-3"]],
  ["2-0 > 1-0", lookupTable["2-0"], lookupTable["1-0"]],
  ["3-0 > 2-0", lookupTable["3-0"], lookupTable["2-0"]],
  ["3-1 > 3-2", lookupTable["3-1"], lookupTable["3-2"]],
] as Array<[string, number, number]>;

let allPassed = true;
for (const [label, a, b] of checks) {
  const pass = a > b;
  console.log(`  ${pass ? "PASS" : "FAIL"}: ${label} (${a.toFixed(4)} vs ${b.toFixed(4)})`);
  if (!pass) allPassed = false;
}
console.log(allPassed ? "\nAll monotonicity checks passed!" : "\nSome checks FAILED — review sigmoid fit.");
