/**
 * Ranking Engine — FIFA-aligned Elo with offensive/defensive split.
 *
 * Core formula matches FIFA's "SUM" algorithm (adopted 2018):
 *   P = P_before + I * (W - W_e)
 *   W_e = 1 / (10^(-dr/600) + 1)
 *
 * Key FIFA alignment:
 * - 600-point scaling factor (not 400)
 * - No goal difference multiplier (prevents blowout inflation)
 * - No home advantage in Elo (home advantage lives in prediction engine)
 * - Knockout loss protection (teams don't lose points in KO rounds)
 * - PSO loser treated as draw (W=0.5), winner gets W=0.75
 * - I values matched to FIFA's official weighting
 *
 * Our additions beyond FIFA:
 * - Offensive/defensive sub-rating split (feeds prediction model)
 * - Confederation quality adjustment on display ratings
 * - Annual mean reversion (3% toward 1500)
 */

import type { MatchImportance } from "@/app/generated/prisma/client";

// --- I values (match importance) aligned with FIFA ---
// FIFA uses 5/10 for friendlies, but our CSV doesn't distinguish
// calendar vs non-calendar friendlies, so we use 10 as default.
const K_VALUES: Record<string, number> = {
  FRIENDLY: 10,
  NATIONS_LEAGUE: 15,
  QUALIFIER: 25,
  TOURNAMENT_GROUP: 35,
  TOURNAMENT_KNOCKOUT: 40,
};

// More granular I values for specific tournament stages
const TOURNAMENT_K: Record<string, number> = {
  "Continental qualifier": 25,
  "World Cup qualifier": 25,
  "Continental group": 35,
  "Continental knockout": 40,
  "World Cup group": 50,
  "World Cup knockout": 60,
};

// Annual mean reversion rate: pull ratings 3% toward 1500 each year.
const MEAN_REVERSION_RATE = 0.03;
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
 * Get the I factor (importance) for a match, aligned with FIFA values.
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

  return K_VALUES[importance] ?? 10;
}

/**
 * Expected result using the FIFA Elo formula.
 * Uses 600-point scaling (FIFA standard) instead of traditional 400.
 * This makes the system less volatile — a 200-point gap produces a
 * smaller expected advantage than in standard Elo.
 */
export function expectedResult(
  teamRating: number,
  opponentRating: number
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 600));
}

/**
 * Determine match result values.
 * Returns [homeW, awayW] where W is 1 (win), 0.5 (draw), 0 (loss).
 *
 * FIFA PSO rule: winner gets 0.75, LOSER gets 0.5 (treated as draw).
 * This is more generous to the loser than standard Elo (which gives 0.25).
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
      return [0.75, 0.5];
    if (match.homeScorePenalties < match.awayScorePenalties)
      return [0.5, 0.75];
  }

  return [0.5, 0.5];
}

/**
 * Mild goal difference multiplier using log scaling.
 * A 5-0 win is more informative than a 1-0 win, but not 5x as much.
 * Capped at 1.5 to prevent blowout inflation (FIFA uses no multiplier
 * at all; we use a conservative one as a middle ground).
 */
export function goalDiffMultiplier(goalDiff: number): number {
  const absDiff = Math.abs(goalDiff);
  if (absDiff <= 1) return 1.0;
  return Math.min(1 + Math.log(absDiff) * 0.25, 1.5);
}

/**
 * Check if a match is in a knockout round of a final competition.
 */
function isKnockoutRound(match: MatchInput): boolean {
  return match.matchImportance === "TOURNAMENT_KNOCKOUT";
}

/**
 * Calculate new Elo ratings after a match.
 *
 * Key FIFA rules applied:
 * - No home advantage in Elo (home advantage is for predictions only)
 * - Knockout loss protection: teams can't lose points in KO rounds
 * - 600-point scaling, FIFA-aligned I values, PSO loser = draw
 *
 * Our additions beyond FIFA:
 * - Offensive/defensive split (60/40 based on scoring pattern)
 * - Mild goal difference multiplier (capped at 1.5x)
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

  // No home advantage in Elo — ratings reflect pure team strength.
  // Home advantage is modeled separately in the prediction engine.
  const homeOverall = (homeElo.offensive + (3000 - homeElo.defensive)) / 2;
  const awayOverall = (awayElo.offensive + (3000 - awayElo.defensive)) / 2;

  const We_home = expectedResult(homeOverall, awayOverall);
  const We_away = 1 - We_home;

  const [W_home, W_away] = matchResult(match);

  // Goal diff multiplier applies only to POSITIVE deltas (decisive wins
  // are rewarded, but blowout losses are NOT extra-penalized). The margin
  // of a large loss says more about the winner than the loser.
  const G = goalDiffMultiplier(match.homeScore - match.awayScore);
  const homeRaw = W_home - We_home;
  const awayRaw = W_away - We_away;
  let homeDelta = K * (homeRaw > 0 ? G : 1) * homeRaw;
  let awayDelta = K * (awayRaw > 0 ? G : 1) * awayRaw;

  // FIFA knockout loss protection: teams that earn negative points
  // in knockout rounds of final competitions don't lose any points.
  if (isKnockoutRound(match)) {
    if (homeDelta < 0) homeDelta = 0;
    if (awayDelta < 0) awayDelta = 0;
  }

  // Determine offensive/defensive split based on scoring pattern
  const homeScored = match.homeScore;
  const awayScored = match.awayScore;

  // If team scored more than conceded: 60% off, 40% def
  // If team conceded more or drew: 40% off, 60% def
  const homeOffSplit =
    homeScored > awayScored ? 0.6 : homeScored === awayScored ? 0.4 : 0.4;
  const homeDefSplit = 1 - homeOffSplit;

  const awayOffSplit =
    awayScored > homeScored ? 0.6 : awayScored === homeScored ? 0.4 : 0.4;
  const awayDefSplit = 1 - awayOffSplit;

  return {
    homeElo: {
      offensive: homeElo.offensive + homeDelta * homeOffSplit,
      defensive: homeElo.defensive - homeDelta * homeDefSplit,
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
 * Confederation quality factors — scale the deviation from 1500 to correct
 * for "closed-loop" inflation in weaker confederations. Teams in AFC/CAF
 * accumulate inflated Elo from beating many weak intra-confederation
 * opponents, while UEFA/CONMEBOL teams face tougher competition.
 *
 * Note: FIFA explicitly has NO confederation weighting, but they accept
 * the resulting inflation. We apply a mild correction because our system
 * is used for predictions where accuracy matters more than parity.
 */
const CONFEDERATION_QUALITY: Record<string, number> = {
  UEFA: 1.0,
  CONMEBOL: 1.0,
  CONCACAF: 0.88,
  CAF: 0.78,
  AFC: 0.77,
  OFC: 0.70,
};

/**
 * Combine Elo-based and roster-based ratings (70/30 split),
 * then apply confederation quality adjustment.
 */
export function combinedRating(
  eloOff: number,
  eloDef: number,
  rosterOff: number,
  rosterDef: number,
  confederation?: string
): { offensive: number; defensive: number; overall: number } {
  const rawOff = 0.7 * eloOff + 0.3 * rosterOff;
  const rawDef = 0.7 * eloDef + 0.3 * rosterDef;

  // Apply confederation quality factor to the deviation from mean
  const confQ = confederation ? (CONFEDERATION_QUALITY[confederation] ?? 0.90) : 1.0;
  const offensive = MEAN_RATING + (rawOff - MEAN_RATING) * confQ;
  const defensive = MEAN_RATING + (rawDef - MEAN_RATING) * confQ;

  return {
    offensive,
    defensive,
    overall: overallRating(offensive, defensive),
  };
}

/**
 * Apply annual mean reversion — pull ratings toward 1500 by MEAN_REVERSION_RATE.
 * Should be called once per year (e.g., Jan 1) to account for squad turnover
 * between international cycles.
 */
export function applyMeanReversion(elo: TeamElo): TeamElo {
  return {
    offensive: elo.offensive + (MEAN_RATING - elo.offensive) * MEAN_REVERSION_RATE,
    defensive: elo.defensive + (MEAN_RATING - elo.defensive) * MEAN_REVERSION_RATE,
  };
}
