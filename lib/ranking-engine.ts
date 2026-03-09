/**
 * Ranking Engine — Elo calculations with offensive/defensive split.
 *
 * Each team maintains two Elo sub-ratings (Offensive and Defensive).
 * Match results adjust both sub-ratings with a 60/40 split based on
 * the scoring pattern of the match.
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
 * Goal difference multiplier.
 * 1-goal win: 1.0
 * 2-goal win: 1 + (diff - 1) * 0.5 = 1.5
 * 3+ goal win: 1 + (diff - 1) * 0.75, capped at 3.0
 */
export function goalDiffMultiplier(goalDiff: number): number {
  const absDiff = Math.abs(goalDiff);
  if (absDiff <= 1) return 1.0;
  if (absDiff === 2) return 1.5;
  return Math.min(1 + (absDiff - 1) * 0.75, 3.0);
}

/**
 * Home advantage bonus in Elo points.
 */
export function homeAdvantage(
  neutralVenue: boolean,
  importance: MatchImportance
): number {
  if (neutralVenue) return 0;
  if (importance === "FRIENDLY") return 75;
  return 100;
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
  const ha = homeAdvantage(match.neutralVenue, match.matchImportance);

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
