/**
 * Margin-Optimized Elo Engine
 *
 * FIFA-aligned Elo variant with a heavy goal-difference multiplier
 * that emphasizes margin of victory: G = 1 + 0.5 * ln(1 + |gd|).
 *
 * This makes the model more sensitive to blowout wins/losses than
 * standard Elo, which improves margin prediction at a slight cost
 * to raw outcome accuracy.
 *
 * #4 composite score in backtesting: Brier=0.5477, 57.2% accuracy,
 * MarginMAE=1.336 across 2,083 tournament matches (2013-2024).
 */

import type { MatchImportance } from "@/app/generated/prisma/client";

const K_VALUES: Record<string, number> = {
  FRIENDLY: 10,
  NATIONS_LEAGUE: 15,
  QUALIFIER: 25,
  TOURNAMENT_GROUP: 35,
  TOURNAMENT_KNOCKOUT: 40,
};

const MEAN_REVERSION_RATE = 0.08;
const MEAN_RATING = 1500;

export interface MoEloState {
  offensive: number;
  defensive: number;
}

export function initMoElo(): MoEloState {
  return { offensive: MEAN_RATING, defensive: MEAN_RATING };
}

export function moEloOverall(state: MoEloState): number {
  return (state.offensive + (3000 - state.defensive)) / 2;
}

function expectedResult(teamRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 600));
}

/**
 * Heavy goal-diff multiplier: 1 + 0.5 * ln(1 + |gd|).
 * Unlike standard Elo's log(|gd|)*0.12 capped at 1.25, this goes higher.
 */
function goalDiffMultiplier(goalDiff: number): number {
  const absDiff = Math.abs(goalDiff);
  if (absDiff === 0) return 1.0;
  return 1.0 + 0.5 * Math.log(1 + absDiff);
}

function matchW(
  homeScore: number,
  awayScore: number,
  homePen?: number | null,
  awayPen?: number | null,
): [number, number] {
  if (homeScore > awayScore) return [1, 0];
  if (homeScore < awayScore) return [0, 1];
  if (homePen != null && awayPen != null) {
    if (homePen > awayPen) return [0.75, 0.5];
    if (awayPen > homePen) return [0.5, 0.75];
  }
  return [0.5, 0.5];
}

/**
 * Process a single match and return updated Elo states.
 */
export function processMoEloMatch(
  homeState: MoEloState,
  awayState: MoEloState,
  homeScore: number,
  awayScore: number,
  importance: string,
  isNeutral: boolean,
  homeScorePenalties?: number | null,
  awayScorePenalties?: number | null,
): { home: MoEloState; away: MoEloState } {
  const homeOverall = moEloOverall(homeState);
  const awayOverall = moEloOverall(awayState);

  const weHome = expectedResult(homeOverall, awayOverall);
  const weAway = 1 - weHome;

  const [wHome, wAway] = matchW(homeScore, awayScore, homeScorePenalties, awayScorePenalties);

  const K = K_VALUES[importance] ?? 10;
  const G = goalDiffMultiplier(homeScore - awayScore);

  let homeDelta = K * G * (wHome - weHome);
  let awayDelta = K * G * (wAway - weAway);

  // Knockout loss protection
  if (importance === "TOURNAMENT_KNOCKOUT") {
    if (homeDelta < 0) homeDelta = 0;
    if (awayDelta < 0) awayDelta = 0;
  }

  // 50/50 off/def split
  return {
    home: {
      offensive: homeState.offensive + homeDelta * 0.5,
      defensive: homeState.defensive - homeDelta * 0.5,
    },
    away: {
      offensive: awayState.offensive + awayDelta * 0.5,
      defensive: awayState.defensive - awayDelta * 0.5,
    },
  };
}

/**
 * Apply annual mean reversion toward 1500.
 */
export function applyMoEloReversion(state: MoEloState): MoEloState {
  return {
    offensive: state.offensive + (MEAN_RATING - state.offensive) * MEAN_REVERSION_RATE,
    defensive: state.defensive + (MEAN_RATING - state.defensive) * MEAN_REVERSION_RATE,
  };
}
