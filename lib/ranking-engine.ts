/**
 * Ranking Engine — Elo calculations with offensive/defensive split.
 *
 * Each team maintains two Elo sub-ratings (Offensive and Defensive).
 * Match results adjust both sub-ratings with a 60/40 split based on
 * the scoring pattern of the match.
 *
 * Methodology notes:
 * - Log-based goal diff multiplier (Pomeroy-style information content)
 * - Confederation-specific home advantage
 * - Annual mean reversion toward 1500 (5% per year between cycles)
 */

import type { MatchImportance } from "@/app/generated/prisma/client";

// --- K values by match importance ---
const K_VALUES: Record<string, number> = {
  FRIENDLY: 15,
  NATIONS_LEAGUE: 25,
  QUALIFIER: 30,
  TOURNAMENT_GROUP: 40,
  TOURNAMENT_KNOCKOUT: 50,
};

// More granular K values for specific tournament stages
const TOURNAMENT_K: Record<string, number> = {
  "Continental qualifier": 25,
  "World Cup qualifier": 30,
  "Continental group": 35,
  "Continental knockout": 40,
  "World Cup group": 45,
  "World Cup knockout": 55,
};

// --- Confederation-specific home advantage ---
// Derived from empirical research on international match home advantage.
// South American and African qualifiers have larger home effects (altitude,
// travel, climate). UEFA home advantage is more modest.
const CONFEDERATION_HOME_ADVANTAGE: Record<string, number> = {
  CONMEBOL: 120,
  CAF: 115,
  AFC: 110,
  CONCACAF: 110,
  UEFA: 90,
  OFC: 100,
};

// Annual mean reversion rate: pull ratings 5% toward 1500 each year
const MEAN_REVERSION_RATE = 0.05;
const MEAN_RATING = 1500;

export interface TeamElo {
  offensive: number;
  defensive: number;
}

export interface MatchInput {
  homeScore: number;
  awayScore: number;
  homeScorePenalties?: number | null;
  awayScorePenalties?: number | null;
  matchImportance: MatchImportance;
  tournament?: string;
  tournamentStage?: string | null;
  neutralVenue: boolean;
  homeConfederation?: string;
}

export interface EloResult {
  homeElo: TeamElo;
  awayElo: TeamElo;
}

/**
 * Get the K factor for a given match importance and optional tournament details.
 */
export function getKFactor(
  importance: MatchImportance,
  tournament?: string,
  stage?: string | null
): number {
  // Try granular tournament K first
  if (tournament && stage) {
    const isWorldCup = tournament.toLowerCase().includes("world cup");
    const isKnockout =
      stage.toLowerCase().includes("quarter") ||
      stage.toLowerCase().includes("semi") ||
      stage.toLowerCase().includes("final") ||
      stage.toLowerCase().includes("round of");

    if (isWorldCup && isKnockout) return TOURNAMENT_K["World Cup knockout"];
    if (isWorldCup) return TOURNAMENT_K["World Cup group"];
    if (isKnockout) return TOURNAMENT_K["Continental knockout"];
  }

  return K_VALUES[importance] ?? 15;
}

/**
 * Goal difference multiplier using log-based information content.
 * Larger margins carry more information but with diminishing returns.
 * log(1 + diff) better matches the predictive value of different margins
 * than a linear multiplier — a 5-0 is informative but not 5x as
 * informative as 1-0 (the losing team takes more risks at large deficits).
 */
export function goalDiffMultiplier(goalDiff: number): number {
  const absDiff = Math.abs(goalDiff);
  if (absDiff <= 0) return 1.0;
  return Math.min(1 + Math.log(absDiff + 1) * 0.85, 3.0);
}

/**
 * Home advantage bonus in Elo points.
 * Varies by confederation — South American and African qualifiers have
 * significantly higher home advantage due to altitude, travel distance,
 * climate, and crowd intensity.
 */
export function homeAdvantage(
  neutralVenue: boolean,
  importance: MatchImportance,
  homeConfederation?: string
): number {
  if (neutralVenue) return 0;
  const baseAdvantage = homeConfederation
    ? (CONFEDERATION_HOME_ADVANTAGE[homeConfederation] ?? 100)
    : 100;
  if (importance === "FRIENDLY") return baseAdvantage * 0.75;
  return baseAdvantage;
}

/**
 * Expected result using the Elo formula.
 */
export function expectedResult(
  teamRating: number,
  opponentRating: number
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 400));
}

/**
 * Determine match result values.
 * Returns [homeW, awayW] where W is 1 (win), 0.5 (draw), 0 (loss).
 * Penalty shootout results: 0.75/0.25.
 */
export function matchResult(match: MatchInput): [number, number] {
  if (match.homeScore > match.awayScore) return [1, 0];
  if (match.homeScore < match.awayScore) return [0, 1];

  // Draw in regular time — check penalties
  if (
    match.homeScorePenalties != null &&
    match.awayScorePenalties != null
  ) {
    if (match.homeScorePenalties > match.awayScorePenalties)
      return [0.75, 0.25];
    if (match.homeScorePenalties < match.awayScorePenalties)
      return [0.25, 0.75];
  }

  return [0.5, 0.5];
}

/**
 * Calculate new Elo ratings after a match.
 *
 * The offensive/defensive split is 60/40:
 * - When a team scores more: 60% adjustment to offensive Elo, 40% to defensive
 * - When a team concedes less: 60% adjustment to defensive Elo, 40% to offensive
 * - Draws: 60% defensive, 40% offensive
 */
export function calculateElo(
  homeElo: TeamElo,
  awayElo: TeamElo,
  match: MatchInput
): EloResult {
  const K = getKFactor(
    match.matchImportance,
    match.tournament,
    match.tournamentStage
  );
  const G = goalDiffMultiplier(match.homeScore - match.awayScore);
  const ha = homeAdvantage(match.neutralVenue, match.matchImportance, match.homeConfederation);

  // Combined ratings for expected result calculation
  const homeOverall = (homeElo.offensive + (3000 - homeElo.defensive)) / 2 + ha;
  const awayOverall = (awayElo.offensive + (3000 - awayElo.defensive)) / 2;

  const We_home = expectedResult(homeOverall, awayOverall);
  const We_away = 1 - We_home;

  const [W_home, W_away] = matchResult(match);

  const homeDelta = K * G * (W_home - We_home);
  const awayDelta = K * G * (W_away - We_away);

  // Determine offensive/defensive split based on scoring pattern
  const homeScored = match.homeScore;
  const awayConceded = match.homeScore;
  const awayScored = match.awayScore;

  // If team scored more than conceded: 60% off, 40% def
  // If team conceded less than scored (clean sheet / good defense): 60% def, 40% off
  // Draws: 60% def, 40% off
  const homeOffSplit =
    homeScored > awayScored ? 0.6 : homeScored === awayScored ? 0.4 : 0.4;
  const homeDefSplit = 1 - homeOffSplit;

  const awayOffSplit =
    awayScored > homeScored ? 0.6 : awayScored === homeScored ? 0.4 : 0.4;
  const awayDefSplit = 1 - awayOffSplit;

  return {
    homeElo: {
      offensive: homeElo.offensive + homeDelta * homeOffSplit,
      defensive: homeElo.defensive - homeDelta * homeDefSplit, // Lower defensive = better
    },
    awayElo: {
      offensive: awayElo.offensive + awayDelta * awayOffSplit,
      defensive: awayElo.defensive - awayDelta * awayDefSplit,
    },
  };
}

/**
 * Compute overall rating from offensive and defensive ratings.
 * Defensive is inverted (lower = better defense).
 */
export function overallRating(offensive: number, defensive: number): number {
  return (offensive + (3000 - defensive)) / 2;
}

/**
 * Combine Elo-based and roster-based ratings (70/30 split).
 */
export function combinedRating(
  eloOff: number,
  eloDef: number,
  rosterOff: number,
  rosterDef: number
): { offensive: number; defensive: number; overall: number } {
  const offensive = 0.7 * eloOff + 0.3 * rosterOff;
  const defensive = 0.7 * eloDef + 0.3 * rosterDef;
  return {
    offensive,
    defensive,
    overall: overallRating(offensive, defensive),
  };
}

/**
 * Apply annual mean reversion — pull ratings toward 1500 by MEAN_REVERSION_RATE.
 * Should be called once per year (e.g., Jan 1) to account for squad turnover
 * between international cycles. Prevents stale ratings from dominating.
 */
export function applyMeanReversion(elo: TeamElo): TeamElo {
  return {
    offensive: elo.offensive + (MEAN_RATING - elo.offensive) * MEAN_REVERSION_RATE,
    defensive: elo.defensive + (MEAN_RATING - elo.defensive) * MEAN_REVERSION_RATE,
  };
}
