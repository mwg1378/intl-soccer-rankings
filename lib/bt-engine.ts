/**
 * Bradley-Terry Ranking Engine
 *
 * An equilibrium-based ranking system that finds ratings where each team's
 * weighted expected wins equal their weighted actual wins. Key differences
 * from the Elo system:
 *
 * - Batch MLE solver (not sequential updates) — ratings are globally optimal
 * - Time decay with 2-year half-life (not annual mean reversion)
 * - Empirically-derived scoreline mapping (not formula-based goal diff)
 * - Fixed global home advantage (not per-team)
 * - Single rating per team (not offensive/defensive split)
 * - No confederation penalty — cross-confederation games calibrate naturally
 *
 * Uses the same 1500-centered, 600-point scale as Elo for comparability.
 */

import { getKFactor } from "./ranking-engine";
import type { MatchImportance } from "@/app/generated/prisma/client";

// --- Constants ---

export const BT_HOME_ADVANTAGE = 50; // fixed Elo points for home team
export const HALF_LIFE_DAYS = 730; // 2-year half-life for time decay
export const DEFAULT_RATING = 1500;
const CONVERGENCE_THRESHOLD = 1.0; // rating points (sub-1pt differences are negligible)
const MAX_ITERATIONS = 200;
const MAX_STEP = 30; // clamp Newton step to avoid overshooting for sparse teams
const SCALE = Math.log(10) / 600; // logistic scale factor (FIFA 600-pt)

// --- Empirical Scoreline Mapping ---
// Derived from 49,071 historical international matches.
// W = sigmoid(α * goalDiff + β * totalGoals + γ)
// Represents how predictive each scoreline is of future results.
// From the winner's perspective: W > 0.5 means the winner is favored in rematches.

const SCORELINE_SIGMOID = {
  alpha: 0.266974,
  beta: -0.041858,
  gamma: 0.077257,
};

// Pre-computed lookup table for common scorelines (winner's perspective)
const SCORELINE_W: Record<string, number> = {
  "1-0": 0.575,
  "2-1": 0.5544,
  "3-2": 0.5337,
  "4-3": 0.5128,
  "5-4": 0.4919,
  "6-5": 0.471,
  "7-6": 0.4502,
  "8-7": 0.4296,
  "2-0": 0.6289,
  "3-1": 0.6092,
  "4-2": 0.5891,
  "5-3": 0.5686,
  "6-4": 0.548,
  "7-5": 0.5272,
  "8-6": 0.5063,
  "3-0": 0.6797,
  "4-1": 0.6613,
  "5-2": 0.6423,
  "6-3": 0.6228,
  "7-4": 0.6029,
  "8-5": 0.5827,
  "4-0": 0.7267,
  "5-1": 0.7097,
  "6-2": 0.6922,
  "7-3": 0.6741,
  "8-4": 0.6554,
  "5-0": 0.769,
  "6-1": 0.7538,
  "7-2": 0.738,
  "8-3": 0.7215,
  "6-0": 0.8066,
  "7-1": 0.7932,
  "8-2": 0.7791,
  "7-0": 0.8393,
  "8-1": 0.8277,
  "8-0": 0.8674,
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Get the W value for the home team given a scoreline.
 * Returns a value between 0 and 1 where 0.5 = draw.
 */
export function getScorelineW(
  homeScore: number,
  awayScore: number,
  homePenalties?: number | null,
  awayPenalties?: number | null
): number {
  // Draw in regulation
  if (homeScore === awayScore) {
    // PSO: small bonus for the winner
    if (homePenalties != null && awayPenalties != null) {
      if (homePenalties > awayPenalties) return 0.55;
      if (awayPenalties > homePenalties) return 0.45;
    }
    return 0.5;
  }

  // Decisive result — look up from winner's perspective
  const winnerScore = Math.max(homeScore, awayScore);
  const loserScore = Math.min(homeScore, awayScore);
  const key = `${winnerScore}-${loserScore}`;

  let winnerW: number;
  if (key in SCORELINE_W) {
    winnerW = SCORELINE_W[key];
  } else {
    // Fallback to sigmoid for rare scorelines
    const goalDiff = winnerScore - loserScore;
    const totalGoals = winnerScore + loserScore;
    const x =
      SCORELINE_SIGMOID.alpha * goalDiff +
      SCORELINE_SIGMOID.beta * totalGoals +
      SCORELINE_SIGMOID.gamma;
    winnerW = sigmoid(x);
  }

  // Return from home team's perspective
  return homeScore > awayScore ? winnerW : 1 - winnerW;
}

// --- Time Decay ---

/**
 * Compute time-decay weight for a match. Half-life of ~2 years.
 * A match from 2 years ago is worth 50%, 4 years ago = 25%.
 */
export function timeDecayWeight(matchDate: Date, referenceDate: Date): number {
  const daysDiff =
    (referenceDate.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff < 0) return 1; // future match, full weight
  return Math.pow(0.5, daysDiff / HALF_LIFE_DAYS);
}

// --- Expected Result ---

/**
 * Expected result for team A against team B, with optional home bonus.
 * Same logistic formula as Elo (600-point scale), but with fixed home advantage.
 */
export function btExpectedResult(
  ratingA: number,
  ratingB: number,
  homeBonus: number = 0
): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA - homeBonus) / 600));
}

// --- BT Solver ---

export interface BTMatch {
  homeTeamIndex: number;
  awayTeamIndex: number;
  wHome: number; // scoreline-derived outcome (0–1)
  weight: number; // timeDecay * kValue
  isNeutral: boolean;
}

export interface BTSolverResult {
  ratings: Map<string, number>; // teamId → rating
  iterations: number;
  maxChange: number;
}

export interface BTSolverOptions {
  maxIterations?: number;
  convergenceThreshold?: number;
  warmStart?: Map<string, number>; // teamId → initial rating
}

/**
 * Solve the Bradley-Terry model via Newton-Raphson.
 *
 * Finds ratings {r_i} such that for every team i:
 *   Σ w_m * W_actual(i, m) ≈ Σ w_m * E(i, m)
 *
 * where E(i, m) = 1 / (1 + 10^((r_opponent - r_i ± homeBonus) / 600))
 */
export function solveBradleyTerry(
  teamIds: string[],
  matches: BTMatch[],
  options: BTSolverOptions = {}
): BTSolverResult {
  const {
    maxIterations = MAX_ITERATIONS,
    convergenceThreshold = CONVERGENCE_THRESHOLD,
    warmStart,
  } = options;

  const N = teamIds.length;
  const ratings = new Float64Array(N);

  // Initialize ratings
  if (warmStart) {
    for (let i = 0; i < N; i++) {
      ratings[i] = warmStart.get(teamIds[i]) ?? DEFAULT_RATING;
    }
  } else {
    ratings.fill(DEFAULT_RATING);
  }

  let finalMaxChange = 0;
  let iter = 0;

  for (iter = 0; iter < maxIterations; iter++) {
    const gradient = new Float64Array(N);
    const hessianDiag = new Float64Array(N);

    for (const m of matches) {
      const homeBonus = m.isNeutral ? 0 : BT_HOME_ADVANTAGE;
      const diff =
        (ratings[m.homeTeamIndex] + homeBonus - ratings[m.awayTeamIndex]) *
        SCALE;
      const eHome = 1 / (1 + Math.exp(-diff));

      // Gradient: w * (actual - expected) * scale
      const homeGrad = m.weight * (m.wHome - eHome) * SCALE;
      gradient[m.homeTeamIndex] += homeGrad;
      gradient[m.awayTeamIndex] -= homeGrad;

      // Hessian diagonal: -w * e * (1 - e) * scale^2
      const hess = -m.weight * eHome * (1 - eHome) * SCALE * SCALE;
      hessianDiag[m.homeTeamIndex] += hess;
      hessianDiag[m.awayTeamIndex] += hess;
    }

    // Newton-Raphson update with step clamping
    let maxChange = 0;
    let sumDelta = 0;
    let activeTeams = 0;

    for (let i = 0; i < N; i++) {
      if (hessianDiag[i] === 0) continue; // team with no matches in window
      let delta = -gradient[i] / hessianDiag[i];
      // Clamp step size to avoid overshooting for sparse teams
      delta = Math.max(-MAX_STEP, Math.min(MAX_STEP, delta));
      ratings[i] += delta;
      sumDelta += delta;
      activeTeams++;
      maxChange = Math.max(maxChange, Math.abs(delta));
    }

    // Re-center so mean of active teams = DEFAULT_RATING
    if (activeTeams > 0) {
      const avgDelta = sumDelta / activeTeams;
      for (let i = 0; i < N; i++) {
        if (hessianDiag[i] !== 0) {
          ratings[i] -= avgDelta;
        }
      }
    }

    finalMaxChange = maxChange;
    if (maxChange < convergenceThreshold) {
      iter++;
      break;
    }
  }

  // Build result map
  const resultMap = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    resultMap.set(teamIds[i], Math.round(ratings[i] * 100) / 100);
  }

  return {
    ratings: resultMap,
    iterations: iter,
    maxChange: finalMaxChange,
  };
}

// --- Helper: Prepare matches for solver ---

export interface RawMatchInput {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeScorePenalties?: number | null;
  awayScorePenalties?: number | null;
  date: Date;
  matchImportance: MatchImportance;
  tournament?: string;
  tournamentStage?: string | null;
  neutralVenue: boolean;
}

/**
 * Convert raw match data into the BTMatch format needed by the solver.
 * Computes scoreline W values, time-decay weights, and team index mappings.
 */
export function prepareMatchesForSolver(
  rawMatches: RawMatchInput[],
  referenceDate: Date
): { teamIds: string[]; matches: BTMatch[] } {
  // Collect unique team IDs and build index
  const teamIdSet = new Set<string>();
  for (const m of rawMatches) {
    teamIdSet.add(m.homeTeamId);
    teamIdSet.add(m.awayTeamId);
  }
  const teamIds = [...teamIdSet];
  const teamIndex = new Map<string, number>();
  for (let i = 0; i < teamIds.length; i++) {
    teamIndex.set(teamIds[i], i);
  }

  // Convert matches
  const btMatches: BTMatch[] = [];
  for (const m of rawMatches) {
    const wHome = getScorelineW(
      m.homeScore,
      m.awayScore,
      m.homeScorePenalties,
      m.awayScorePenalties
    );
    const decay = timeDecayWeight(m.date, referenceDate);
    const kFactor = getKFactor(
      m.matchImportance,
      m.tournament,
      m.tournamentStage
    );

    btMatches.push({
      homeTeamIndex: teamIndex.get(m.homeTeamId)!,
      awayTeamIndex: teamIndex.get(m.awayTeamId)!,
      wHome,
      weight: decay * kFactor,
      isNeutral: m.neutralVenue,
    });
  }

  return { teamIds, matches: btMatches };
}
