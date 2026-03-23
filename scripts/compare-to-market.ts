/**
 * Compare all ranking models against betting market WC 2026 odds.
 *
 * For each ranking system:
 *  1. Run Monte Carlo WC simulation (5,000 iterations)
 *  2. Extract championship probabilities
 *  3. Compare against sportsbook consensus odds
 *  4. Compute alignment score (lower = closer to market)
 *
 * Then optimize composite weights to minimize market distance.
 *
 * Usage: npx tsx scripts/compare-to-market.ts
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runSimulation, setRatingStats, type SimulationResults } from "../lib/world-cup-simulator";
import {
  CONFIRMED_TEAMS,
  PLAYOFF_TEAMS,
  dbName,
} from "../lib/world-cup-data";

// --- Initialize Prisma ---
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- Betting market consensus odds (FanDuel/DraftKings/bet365, March 2026) ---
// Implied probabilities from American odds, normalized to sum to ~100%
// Source: Aggregated from NBC Sports, FOX Sports, DraftKings, FanDuel
const MARKET_CHAMPION_ODDS: Record<string, number> = {
  "Spain": 0.152,
  "England": 0.128,
  "France": 0.098,
  "Brazil": 0.093,
  "Argentina": 0.093,
  "Portugal": 0.069,
  "Germany": 0.064,
  "Netherlands": 0.040,
  "Norway": 0.032,
  "Italy": 0.027,
  "Belgium": 0.027,
  "Colombia": 0.020,
  "Morocco": 0.014,
  "Uruguay": 0.013,
  "United States": 0.013,
  "Mexico": 0.012,
  "Ecuador": 0.010,
  "Switzerland": 0.010,
  "Croatia": 0.009,
  "Japan": 0.009,
  "Senegal": 0.007,
  "South Korea": 0.006,
  "Australia": 0.005,
  "Ivory Coast": 0.005,
  "Paraguay": 0.004,
  "Iran": 0.004,
  "Saudi Arabia": 0.003,
  "Scotland": 0.003,
  "Egypt": 0.003,
  "Algeria": 0.003,
  "Austria": 0.003,
  "Tunisia": 0.002,
  "Ghana": 0.002,
  "Panama": 0.002,
  "South Africa": 0.002,
  "Qatar": 0.002,
  "New Zealand": 0.001,
  "Haiti": 0.001,
  "Jordan": 0.001,
  "Uzbekistan": 0.001,
  "Cape Verde": 0.001,
};

// Normalize market odds to sum to 1
const marketTotal = Object.values(MARKET_CHAMPION_ODDS).reduce((s, p) => s + p, 0);
for (const t of Object.keys(MARKET_CHAMPION_ODDS)) {
  MARKET_CHAMPION_ODDS[t] /= marketTotal;
}

// --- Rating extraction functions ---
// Each returns { offensive, defensive } for a team

type RatingExtractor = (team: any) => { offensive: number; defensive: number };

const RATING_SYSTEMS: Record<string, { name: string; extract: RatingExtractor }> = {
  combined: {
    name: "Combined (Elo+Roster)",
    extract: (t) => ({ offensive: t.currentOffensiveRating, defensive: t.currentDefensiveRating }),
  },
  elo: {
    name: "Elo",
    extract: (t) => ({ offensive: t.eloOffensive, defensive: t.eloDefensive }),
  },
  bt: {
    name: "Bradley-Terry",
    extract: (t) => ({ offensive: t.btRating, defensive: 3000 - t.btRating }),
  },
  glicko: {
    name: "Glicko-2",
    extract: (t) => ({ offensive: t.glickoRating, defensive: 3000 - t.glickoRating }),
  },
  berrar: {
    name: "Berrar k-NN",
    extract: (t) => ({ offensive: t.berrarRating, defensive: 3000 - t.berrarRating }),
  },
  moElo: {
    name: "Margin-Optimized Elo",
    extract: (t) => ({ offensive: t.moEloOffensive, defensive: t.moEloDefensive }),
  },
  iwPi: {
    name: "IW Pi-Ratings",
    extract: (t) => ({
      offensive: 1500 + t.iwPiOverall * 100,
      defensive: 1500 - t.iwPiOverall * 100,
    }),
  },
  op: {
    name: "Ordered Probit",
    extract: (t) => ({ offensive: t.opRating, defensive: 3000 - t.opRating }),
  },
  pi: {
    name: "Pi-Ratings",
    extract: (t) => ({
      offensive: 1500 + t.piOverall * 100,
      defensive: 1500 - t.piOverall * 100,
    }),
  },
};

// --- Compute alignment score ---

function computeAlignmentScore(
  simOdds: Record<string, number>,
  marketOdds: Record<string, number>,
): { mse: number; klDiv: number; correlation: number; topNOverlap: number } {
  // Gather common teams
  const teams = Object.keys(marketOdds);
  const simVals: number[] = [];
  const mktVals: number[] = [];

  for (const t of teams) {
    simVals.push(simOdds[t] ?? 0);
    mktVals.push(marketOdds[t]);
  }

  // MSE
  let mse = 0;
  for (let i = 0; i < teams.length; i++) {
    mse += (simVals[i] - mktVals[i]) ** 2;
  }
  mse /= teams.length;

  // KL divergence (market || sim), with smoothing
  let klDiv = 0;
  const eps = 0.0001;
  for (let i = 0; i < teams.length; i++) {
    const p = Math.max(mktVals[i], eps);
    const q = Math.max(simVals[i], eps);
    klDiv += p * Math.log(p / q);
  }

  // Spearman rank correlation
  const simRanked = [...simVals].map((v, i) => ({ val: v, idx: i }))
    .sort((a, b) => b.val - a.val).map((v, rank) => ({ ...v, rank }));
  const mktRanked = [...mktVals].map((v, i) => ({ val: v, idx: i }))
    .sort((a, b) => b.val - a.val).map((v, rank) => ({ ...v, rank }));

  const simRankMap = new Map(simRanked.map(r => [r.idx, r.rank]));
  const mktRankMap = new Map(mktRanked.map(r => [r.idx, r.rank]));

  let d2Sum = 0;
  const n = teams.length;
  for (let i = 0; i < n; i++) {
    const d = (simRankMap.get(i) ?? 0) - (mktRankMap.get(i) ?? 0);
    d2Sum += d * d;
  }
  const correlation = 1 - (6 * d2Sum) / (n * (n * n - 1));

  // Top-5 overlap
  const simTop5 = simRanked.slice(0, 5).map(r => teams[r.idx]);
  const mktTop5 = mktRanked.slice(0, 5).map(r => teams[r.idx]);
  const topNOverlap = simTop5.filter(t => mktTop5.includes(t)).length / 5;

  return { mse, klDiv, correlation, topNOverlap };
}

// --- Run simulation with custom ratings ---

function runWcSim(
  teams: any[],
  ratingSystem: string,
  extract: RatingExtractor,
  iterations: number,
): SimulationResults {
  // Build team data map
  const allTeamNames = [...CONFIRMED_TEAMS, ...PLAYOFF_TEAMS].map(dbName);
  const uniqueNames = [...new Set(allTeamNames)];

  // Compute rating stats
  const offVals: number[] = [];
  const defVals: number[] = [];
  for (const t of teams) {
    if (t.currentRank > 0) {
      const r = extract(t);
      offVals.push(r.offensive);
      defVals.push(r.defensive);
    }
  }
  const avgOff = offVals.reduce((s, v) => s + v, 0) / offVals.length;
  const avgDef = defVals.reduce((s, v) => s + v, 0) / defVals.length;
  const stdOff = Math.sqrt(offVals.reduce((s, v) => s + (v - avgOff) ** 2, 0) / offVals.length);
  const stdDef = Math.sqrt(defVals.reduce((s, v) => s + (v - avgDef) ** 2, 0) / defVals.length);

  setRatingStats({ avgOff, avgDef, stdOff: Math.max(stdOff, 50), stdDef: Math.max(stdDef, 50) });

  const teamLookup = new Map<string, any>();
  for (const t of teams) teamLookup.set(t.name, t);

  const teamDataMap = new Map<string, {
    name: string; dbName: string; slug: string;
    ratings: { offensive: number; defensive: number };
  }>();

  for (const name of uniqueNames) {
    const t = teamLookup.get(name);
    if (t) {
      teamDataMap.set(name, {
        name, dbName: name, slug: t.slug,
        ratings: extract(t),
      });
    } else {
      teamDataMap.set(name, {
        name, dbName: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        ratings: { offensive: avgOff, defensive: avgDef },
      });
    }
  }

  return runSimulation(teamDataMap, iterations);
}

// --- Composite blend ---

function blendRatings(
  teams: any[],
  weights: Record<string, number>,
): Map<string, { offensive: number; defensive: number }> {
  const result = new Map<string, { offensive: number; defensive: number }>();

  for (const t of teams) {
    let offSum = 0;
    let defSum = 0;
    let totalW = 0;

    for (const [sysId, w] of Object.entries(weights)) {
      if (w <= 0) continue;
      const sys = RATING_SYSTEMS[sysId];
      if (!sys) continue;
      const r = sys.extract(t);
      offSum += r.offensive * w;
      defSum += r.defensive * w;
      totalW += w;
    }

    if (totalW > 0) {
      result.set(t.name, { offensive: offSum / totalW, defensive: defSum / totalW });
    } else {
      result.set(t.name, { offensive: 1500, defensive: 1500 });
    }
  }

  return result;
}

function runBlendedSim(
  teams: any[],
  weights: Record<string, number>,
  iterations: number,
): SimulationResults {
  const blended = blendRatings(teams, weights);
  const allTeamNames = [...CONFIRMED_TEAMS, ...PLAYOFF_TEAMS].map(dbName);
  const uniqueNames = [...new Set(allTeamNames)];

  // Stats from blended
  const offVals: number[] = [];
  const defVals: number[] = [];
  for (const t of teams) {
    if (t.currentRank > 0) {
      const r = blended.get(t.name);
      if (r) { offVals.push(r.offensive); defVals.push(r.defensive); }
    }
  }
  const avgOff = offVals.reduce((s, v) => s + v, 0) / offVals.length;
  const avgDef = defVals.reduce((s, v) => s + v, 0) / defVals.length;
  const stdOff = Math.sqrt(offVals.reduce((s, v) => s + (v - avgOff) ** 2, 0) / offVals.length);
  const stdDef = Math.sqrt(defVals.reduce((s, v) => s + (v - avgDef) ** 2, 0) / defVals.length);
  setRatingStats({ avgOff, avgDef, stdOff: Math.max(stdOff, 50), stdDef: Math.max(stdDef, 50) });

  const teamLookup = new Map<string, any>();
  for (const t of teams) teamLookup.set(t.name, t);

  const teamDataMap = new Map<string, {
    name: string; dbName: string; slug: string;
    ratings: { offensive: number; defensive: number };
  }>();

  for (const name of uniqueNames) {
    const t = teamLookup.get(name);
    const r = blended.get(name);
    teamDataMap.set(name, {
      name, dbName: name,
      slug: t?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      ratings: r ?? { offensive: avgOff, defensive: avgDef },
    });
  }

  return runSimulation(teamDataMap, iterations);
}

// --- Extract championship odds from simulation results ---

function extractChampOdds(
  results: SimulationResults,
  teams: any[],
): Record<string, number> {
  const odds: Record<string, number> = {};
  const slugToName = new Map<string, string>();
  for (const t of teams) slugToName.set(t.slug, t.name);

  for (const [slug, data] of Object.entries(results.advancementOdds)) {
    const name = slugToName.get(slug) ?? data.name;
    odds[name] = data.probChampion;
  }
  return odds;
}

// --- Main ---

async function main() {
  const ITERATIONS = 5000; // balance between speed and accuracy
  console.log("=== Compare Rankings to Betting Market WC 2026 Odds ===\n");

  // Load all teams
  const teams = await prisma.team.findMany();
  console.log(`Loaded ${teams.length} teams\n`);

  // --- Phase 1: Run simulation for each ranking system ---
  console.log("Phase 1: Running WC simulations for each ranking system...\n");

  const results: Array<{
    id: string;
    name: string;
    champOdds: Record<string, number>;
    alignment: ReturnType<typeof computeAlignmentScore>;
  }> = [];

  for (const [sysId, sys] of Object.entries(RATING_SYSTEMS)) {
    process.stdout.write(`  ${sys.name}... `);
    const simResults = runWcSim(teams, sysId, sys.extract, ITERATIONS);
    const champOdds = extractChampOdds(simResults, teams);
    const alignment = computeAlignmentScore(champOdds, MARKET_CHAMPION_ODDS);
    results.push({ id: sysId, name: sys.name, champOdds, alignment });
    console.log(
      `MSE=${alignment.mse.toFixed(6)} KL=${alignment.klDiv.toFixed(4)} ` +
      `Corr=${alignment.correlation.toFixed(3)} Top5=${(alignment.topNOverlap * 100).toFixed(0)}%`
    );
  }

  // Sort by MSE
  results.sort((a, b) => a.alignment.mse - b.alignment.mse);

  console.log("\n--- Individual Rankings vs Market (sorted by MSE) ---\n");
  console.log("Rank  Model                     MSE        KL-Div   Corr    Top-5");
  console.log("----  -----                     ---        ------   ----    -----");
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(
      `${String(i + 1).padStart(4)}  ${r.name.padEnd(25)} ${r.alignment.mse.toFixed(6)}  ` +
      `${r.alignment.klDiv.toFixed(4)}  ${r.alignment.correlation.toFixed(3)}   ${(r.alignment.topNOverlap * 100).toFixed(0)}%`
    );
  }

  // --- Phase 2: Print top-10 championship odds for best model vs market ---
  const best = results[0];
  console.log(`\n--- Top 10: Market vs ${best.name} ---\n`);
  console.log("Team                    Market    Model     Diff");
  console.log("----                    ------    -----     ----");
  const mktSorted = Object.entries(MARKET_CHAMPION_ODDS).sort((a, b) => b[1] - a[1]);
  for (const [team, mktProb] of mktSorted.slice(0, 10)) {
    const simProb = best.champOdds[team] ?? 0;
    const diff = simProb - mktProb;
    console.log(
      `${team.padEnd(23)} ${(mktProb * 100).toFixed(1)}%     ${(simProb * 100).toFixed(1)}%    ${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)}%`
    );
  }

  // --- Phase 3: Optimize composite weights ---
  console.log("\n\nPhase 2: Optimizing composite blends...\n");

  // Try several hand-crafted blends based on the individual results
  const composites: Array<{
    name: string;
    weights: Record<string, number>;
    description: string;
    champOdds?: Record<string, number>;
    alignment?: ReturnType<typeof computeAlignmentScore>;
  }> = [
    {
      name: "Market-Fit Blend",
      description: "Weighted average of all models, weights proportional to 1/MSE market alignment. " +
        "Models that individually match the market better get more influence.",
      weights: {},
    },
    {
      name: "Top-3 Equal",
      description: "Equal-weight blend of the 3 models with lowest MSE vs market. " +
        "Simple ensemble that avoids overfitting to a single model.",
      weights: {},
    },
    {
      name: "Backtested+Market",
      description: "50/50 blend of the best backtested model (IW Pi-Ratings, best Brier score) " +
        "and the best market-aligned model. Balances historical prediction accuracy with " +
        "market-implied team strength.",
      weights: {},
    },
  ];

  // Market-Fit Blend: weight by 1/MSE
  {
    const blend = composites[0];
    let totalInvMse = 0;
    for (const r of results) {
      const invMse = 1 / (r.alignment.mse + 0.00001);
      blend.weights[r.id] = invMse;
      totalInvMse += invMse;
    }
    for (const k of Object.keys(blend.weights)) {
      blend.weights[k] /= totalInvMse;
    }
  }

  // Top-3 Equal
  {
    const blend = composites[1];
    for (let i = 0; i < 3; i++) {
      blend.weights[results[i].id] = 1 / 3;
    }
  }

  // Backtested+Market: IW Pi + best market model
  {
    const blend = composites[2];
    blend.weights["iwPi"] = 0.5; // best backtested
    blend.weights[results[0].id] = 0.5; // best market-fit
  }

  // Run simulations for each composite
  for (const comp of composites) {
    process.stdout.write(`  ${comp.name}... `);
    const simResults = runBlendedSim(teams, comp.weights, ITERATIONS);
    comp.champOdds = extractChampOdds(simResults, teams);
    comp.alignment = computeAlignmentScore(comp.champOdds, MARKET_CHAMPION_ODDS);
    console.log(
      `MSE=${comp.alignment!.mse.toFixed(6)} KL=${comp.alignment!.klDiv.toFixed(4)} ` +
      `Corr=${comp.alignment!.correlation.toFixed(3)} Top5=${(comp.alignment!.topNOverlap * 100).toFixed(0)}%`
    );
  }

  // --- Phase 4: Grid search for optimal 2-model blend ---
  console.log("\n  Grid search for optimal 2-model blend...");
  let bestGridMse = Infinity;
  let bestGridWeights: Record<string, number> = {};
  let bestGridName = "";

  // Only search among top-5 individual models
  const topIds = results.slice(0, 5).map(r => r.id);
  for (let i = 0; i < topIds.length; i++) {
    for (let j = i + 1; j < topIds.length; j++) {
      for (let w = 0.1; w <= 0.9; w += 0.1) {
        const weights: Record<string, number> = {
          [topIds[i]]: w,
          [topIds[j]]: 1 - w,
        };
        const sim = runBlendedSim(teams, weights, 2000); // fewer iters for speed
        const odds = extractChampOdds(sim, teams);
        const align = computeAlignmentScore(odds, MARKET_CHAMPION_ODDS);
        if (align.mse < bestGridMse) {
          bestGridMse = align.mse;
          bestGridWeights = weights;
          bestGridName = `${(w * 100).toFixed(0)}% ${RATING_SYSTEMS[topIds[i]].name} + ${((1 - w) * 100).toFixed(0)}% ${RATING_SYSTEMS[topIds[j]].name}`;
        }
      }
    }
  }

  // Re-run with more iterations
  console.log(`  Best grid blend: ${bestGridName} (MSE=${bestGridMse.toFixed(6)})`);
  process.stdout.write("  Re-running with full iterations... ");
  const gridSim = runBlendedSim(teams, bestGridWeights, ITERATIONS);
  const gridOdds = extractChampOdds(gridSim, teams);
  const gridAlign = computeAlignmentScore(gridOdds, MARKET_CHAMPION_ODDS);
  composites.push({
    name: "Grid-Optimized Blend",
    description: `Optimal 2-model blend found via grid search: ${bestGridName}. ` +
      "Searched all pairs of top-5 models at 10% weight increments to minimize MSE vs market.",
    weights: bestGridWeights,
    champOdds: gridOdds,
    alignment: gridAlign,
  });
  console.log(
    `MSE=${gridAlign.mse.toFixed(6)} KL=${gridAlign.klDiv.toFixed(4)} ` +
    `Corr=${gridAlign.correlation.toFixed(3)} Top5=${(gridAlign.topNOverlap * 100).toFixed(0)}%`
  );

  // --- Summary ---
  console.log("\n\n=== FINAL RESULTS ===\n");
  console.log("--- All Models + Composites vs Market (sorted by MSE) ---\n");

  const allResults = [
    ...results.map(r => ({ name: r.name, alignment: r.alignment, type: "Individual" })),
    ...composites.map(c => ({ name: c.name, alignment: c.alignment!, type: "Composite" })),
  ].sort((a, b) => a.alignment.mse - b.alignment.mse);

  console.log("Rank  Type         Model                     MSE        Corr    Top-5");
  console.log("----  ----         -----                     ---        ----    -----");
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    console.log(
      `${String(i + 1).padStart(4)}  ${r.type.padEnd(12)} ${r.name.padEnd(25)} ${r.alignment.mse.toFixed(6)}  ` +
      `${r.alignment.correlation.toFixed(3)}   ${(r.alignment.topNOverlap * 100).toFixed(0)}%`
    );
  }

  // Print composite details
  console.log("\n\n=== COMPOSITE BLEND DETAILS ===\n");
  for (const comp of composites) {
    console.log(`${comp.name}:`);
    console.log(`  Description: ${comp.description}`);
    console.log(`  Weights:`);
    for (const [sysId, w] of Object.entries(comp.weights)) {
      if (w > 0.001) {
        console.log(`    ${RATING_SYSTEMS[sysId]?.name ?? sysId}: ${(w * 100).toFixed(1)}%`);
      }
    }
    console.log(`  Market alignment: MSE=${comp.alignment!.mse.toFixed(6)}, Corr=${comp.alignment!.correlation.toFixed(3)}`);
    console.log();
  }

  // Print top-10 for best composite vs market
  const bestComp = composites.sort((a, b) => a.alignment!.mse - b.alignment!.mse)[0];
  console.log(`\n--- Top 10: Market vs Best Composite (${bestComp.name}) ---\n`);
  console.log("Team                    Market    Model     Diff");
  for (const [team, mktProb] of mktSorted.slice(0, 15)) {
    const simProb = bestComp.champOdds![team] ?? 0;
    const diff = simProb - mktProb;
    console.log(
      `${team.padEnd(23)} ${(mktProb * 100).toFixed(1)}%     ${(simProb * 100).toFixed(1)}%    ${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)}%`
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
