/**
 * Ranking Engine — FIFA-aligned Elo with offensive/defensive split.
 *
 * Core formula matches FIFA's "SUM" algorithm (adopted 2018):
 *   P = P_before + I * (W - W_e)
 *   W_e = 1 / (10^(-dr/600) + 1)
 *
 * Key FIFA alignment:
 * - 600-point scaling factor (not 400)
 * - No home advantage in Elo (home advantage lives in prediction engine)
 * - Knockout loss protection (teams don't lose points in KO rounds)
 * - PSO loser treated as draw (W=0.5), winner gets W=0.75
 * - I values matched to FIFA's official weighting
 *
 * Our additions beyond FIFA:
 * - Offensive/defensive sub-rating split (feeds prediction model)
 * - Adaptive goal diff multiplier (scales with record lopsidedness)
 * - Per-team home advantage (Bayesian estimate from match history)
 * - Confederation quality adjustment on display ratings
 * - Annual mean reversion (8% toward 1500)
 */

import type { MatchImportance } from "@/app/generated/prisma/client";

// --- I values (match importance) aligned with FIFA ---
const K_VALUES: Record<string, number> = {
  FRIENDLY: 10,
  NATIONS_LEAGUE: 15,
  QUALIFIER: 25,
  TOURNAMENT_GROUP: 35,
  TOURNAMENT_KNOCKOUT: 40,
};

const TOURNAMENT_K: Record<string, number> = {
  "Continental qualifier": 25,
  "World Cup qualifier": 25,
  "Continental group": 35,
  "Continental knockout": 40,
  "World Cup group": 50,
  "World Cup knockout": 60,
};

const MEAN_REVERSION_RATE = 0.08;
const MEAN_RATING = 1500;

// Home advantage Bayesian prior
const HOME_ADVANTAGE_PRIOR = 1.22; // global mean
const HOME_ADVANTAGE_PRIOR_WEIGHT = 30; // equivalent sample size
const HOME_ADVANTAGE_MIN = 0.80;
const HOME_ADVANTAGE_MAX = 2.00;

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
 * Uses 600-point scaling (FIFA standard).
 */
export function expectedResult(
  teamRating: number,
  opponentRating: number
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 600));
}

/**
 * FIFA PSO rule: winner gets 0.75, LOSER gets 0.5 (treated as draw).
 */
export function matchResult(match: MatchInput): [number, number] {
  if (match.homeScore > match.awayScore) return [1, 0];
  if (match.homeScore < match.awayScore) return [0, 1];

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
 * Raw goal difference multiplier (log-based, max 1.25x).
 */
function rawGoalDiffMultiplier(goalDiff: number): number {
  const absDiff = Math.abs(goalDiff);
  if (absDiff <= 1) return 1.0;
  return Math.min(1 + Math.log(absDiff) * 0.12, 1.25);
}

/**
 * Adaptive goal difference multiplier — scales with how lopsided a
 * team's record is.
 *
 * For a team with ~50% win rate, W/L record itself is the strongest
 * signal; goal difference adds noise. For a team that wins 90%,
 * margin differentiates them from another 90% team.
 *
 * extremity = |winRate - 0.5| * 2  (0 = balanced, 1 = lopsided)
 * G = 1.0 + (rawG - 1.0) * extremity^1.5
 */
export function adaptiveGoalDiffMultiplier(
  goalDiff: number,
  winRate: number
): number {
  const rawG = rawGoalDiffMultiplier(goalDiff);
  if (rawG === 1.0) return 1.0;

  const extremity = Math.abs(winRate - 0.5) * 2; // 0..1
  return 1.0 + (rawG - 1.0) * Math.pow(extremity, 1.5);
}

function isKnockoutRound(match: MatchInput): boolean {
  return match.matchImportance === "TOURNAMENT_KNOCKOUT";
}

/**
 * Calculate new Elo ratings after a match.
 *
 * Home advantage is incorporated into the EXPECTED result calculation.
 * The home team's rating is boosted by their home advantage (in Elo points)
 * when computing expectations. This means:
 * - Bolivia beating Brazil at home (huge HA) gets LESS credit than neutral
 * - Bolivia losing away gets LESS penalty (opponent had big HA)
 * - A team playing at USA (small HA) is barely affected
 *
 * Each team gets its own goal diff multiplier based on their running win rate.
 */
export function calculateElo(
  homeElo: TeamElo,
  awayElo: TeamElo,
  match: MatchInput,
  homeWinRate = 0.5,
  awayWinRate = 0.5,
  homeTeamHA = HOME_ADVANTAGE_PRIOR
): EloResult {
  const K = getKFactor(
    match.matchImportance,
    match.tournament,
    match.tournamentStage
  );

  const homeOverall = (homeElo.offensive + (3000 - homeElo.defensive)) / 2;
  const awayOverall = (awayElo.offensive + (3000 - awayElo.defensive)) / 2;

  // Apply home advantage as an Elo bonus for expected result calculation.
  // Convert xG multiplier to Elo points. Moderate scaling so extreme HA
  // teams (Bolivia 1.82x) aren't over-penalized for home wins.
  // 1.22x → +30 pts, 1.82x → +90 pts, 1.09x → +13 pts
  const haEloBonus = match.neutralVenue ? 0 : Math.log(homeTeamHA) * 150;

  const We_home = expectedResult(homeOverall + haEloBonus, awayOverall);
  const We_away = 1 - We_home;

  const [W_home, W_away] = matchResult(match);

  // Per-team adaptive multiplier
  const goalDiff = match.homeScore - match.awayScore;
  const G_home = adaptiveGoalDiffMultiplier(goalDiff, homeWinRate);
  const G_away = adaptiveGoalDiffMultiplier(-goalDiff, awayWinRate);

  let homeDelta = K * G_home * (W_home - We_home);
  let awayDelta = K * G_away * (W_away - We_away);

  // FIFA knockout loss protection
  if (isKnockoutRound(match)) {
    if (homeDelta < 0) homeDelta = 0;
    if (awayDelta < 0) awayDelta = 0;
  }

  // 50/50 off/def split (avoids systematic bias against losing teams)
  const split = 0.5;

  return {
    homeElo: {
      offensive: homeElo.offensive + homeDelta * split,
      defensive: homeElo.defensive - homeDelta * split,
    },
    awayElo: {
      offensive: awayElo.offensive + awayDelta * split,
      defensive: awayElo.defensive - awayDelta * split,
    },
  };
}

/**
 * Compute overall rating from offensive and defensive ratings.
 */
export function overallRating(offensive: number, defensive: number): number {
  return (offensive + (3000 - defensive)) / 2;
}

// --- Confederation strength penalty ---
// Flat Elo point deduction for teams in weaker confederations.
// Teams in CAF/AFC accumulate inflated Elo from intra-confederation play.
// A flat penalty (not compression toward mean) correctly penalizes BOTH
// above-average and below-average teams from weak confederations.
const CONFEDERATION_PENALTY: Record<string, number> = {
  UEFA: 0,
  CONMEBOL: 0,
  CONCACAF: 15,
  CAF: 30,
  AFC: 30,
  OFC: 40,
};

/**
 * Combine Elo + roster ratings (70/30 split) with confederation penalty.
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

  // Flat penalty: subtract from offensive, add to defensive (both worsen the overall)
  const penalty = confederation ? (CONFEDERATION_PENALTY[confederation] ?? 15) : 0;
  const offensive = rawOff - penalty;
  const defensive = rawDef + penalty;

  return { offensive, defensive, overall: overallRating(offensive, defensive) };
}

/**
 * Apply annual mean reversion — pull ratings toward 1500.
 */
export function applyMeanReversion(elo: TeamElo): TeamElo {
  return {
    offensive: elo.offensive + (MEAN_RATING - elo.offensive) * MEAN_REVERSION_RATE,
    defensive: elo.defensive + (MEAN_RATING - elo.defensive) * MEAN_REVERSION_RATE,
  };
}

// --- Running win rate tracking ---

export interface WinRateState {
  wins: number;
  total: number;
}

export function getWinRate(state: WinRateState): number {
  if (state.total < 10) return 0.5; // not enough data
  return state.wins / state.total;
}

export function applyWinRateReversion(state: WinRateState): WinRateState {
  // Pull 15% toward 0.5 annually
  return {
    wins: state.wins * 0.85 + state.total * 0.5 * 0.15,
    total: state.total, // keep total stable
  };
}

// --- Home advantage computation ---

export interface HomeAwayState {
  homeGoalsScored: number;
  homeGoalsConceded: number;
  awayGoalsScored: number;
  awayGoalsConceded: number;
  homeMatches: number;
  awayMatches: number;
}

/**
 * Bayesian home advantage estimate.
 * Prior: 1.22x (global mean), weight of 30 matches.
 * Observed: ratio of home goals-per-game to away goals-per-game.
 * Clamped to [0.8, 2.0].
 */
export function computeHomeAdvantage(state: HomeAwayState): number {
  if (state.homeMatches < 3 || state.awayMatches < 3) {
    return HOME_ADVANTAGE_PRIOR;
  }

  const homeGPG = state.homeGoalsScored / state.homeMatches;
  const awayGPG = state.awayGoalsScored / state.awayMatches;

  if (awayGPG < 0.01) return HOME_ADVANTAGE_PRIOR; // avoid division by zero

  const observedRatio = homeGPG / awayGPG;
  const n = Math.min(state.homeMatches, state.awayMatches);

  const posterior =
    (HOME_ADVANTAGE_PRIOR_WEIGHT * HOME_ADVANTAGE_PRIOR + n * observedRatio) /
    (HOME_ADVANTAGE_PRIOR_WEIGHT + n);

  return Math.max(HOME_ADVANTAGE_MIN, Math.min(HOME_ADVANTAGE_MAX, posterior));
}

export function applyHomeAwayReversion(state: HomeAwayState): HomeAwayState {
  // Decay historical home/away stats by 15% annually (same as win rate)
  const decay = 0.85;
  return {
    homeGoalsScored: state.homeGoalsScored * decay,
    homeGoalsConceded: state.homeGoalsConceded * decay,
    awayGoalsScored: state.awayGoalsScored * decay,
    awayGoalsConceded: state.awayGoalsConceded * decay,
    homeMatches: state.homeMatches * decay,
    awayMatches: state.awayMatches * decay,
  };
}
