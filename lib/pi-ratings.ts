/**
 * Pi-Ratings Engine (Constantinou & Fenton, 2013)
 *
 * Each team maintains two ratings: Home and Away (both start at 0).
 * Ratings represent expected goal-scoring ability in that context.
 * Updates use log-scaled error with diminishing returns.
 *
 * Key advantages over Elo:
 * - Ratings don't grow indefinitely (log-scaled updates)
 * - Separate home/away captures venue-specific strength
 * - A team can lose but improve if they outperformed expectations
 * - Cross-context learning: home results nudge away rating and vice versa
 *
 * Parameters:
 *   c   - scaling constant (controls expected goal diff curve)
 *   mu1 - primary learning rate (how fast the direct rating updates)
 *   mu2 - cross-context learning rate (how much home affects away & vice versa)
 */

export interface PiTeamRatings {
  home: number; // home rating (higher = better at home)
  away: number; // away rating (higher = better away)
}

export interface PiParams {
  c: number;   // scaling constant (paper suggests ~3)
  mu1: number; // primary learning rate (~0.1)
  mu2: number; // cross-context rate (~0.3)
}

// Default parameters from the original paper / typical tuning
export const DEFAULT_PI_PARAMS: PiParams = {
  c: 3,
  mu1: 0.1,
  mu2: 0.3,
};

/**
 * Convert a rating to expected goals vs an average opponent.
 * Uses the formula: sign(r) * (10^(|r|/c) - 1)
 * This maps rating 0 → 0 expected goals advantage,
 * and grows exponentially but with log-scaled updates keeping it bounded.
 */
function ratingToExpectedGoals(rating: number, c: number): number {
  if (rating >= 0) {
    return Math.pow(10, Math.abs(rating) / c) - 1;
  }
  return -(Math.pow(10, Math.abs(rating) / c) - 1);
}

/**
 * Compute expected goal difference for a match.
 * Uses home team's home rating and away team's away rating.
 */
export function expectedGoalDiff(
  homeRating: number,
  awayRating: number,
  c: number
): number {
  const egdHome = ratingToExpectedGoals(homeRating, c);
  const egdAway = ratingToExpectedGoals(awayRating, c);
  return egdHome - egdAway;
}

/**
 * Compute weighted error with log scaling (diminishing returns).
 * Returns [homeUpdate, awayUpdate] — opposite signs.
 */
function getWeightedError(
  c: number,
  observedGD: number,
  expectedGD: number
): [number, number] {
  const error = Math.abs(observedGD - expectedGD);

  if (expectedGD < observedGD) {
    // Home team outperformed expectations
    const we1 = c * Math.log10(1 + error);
    return [we1, -we1];
  } else {
    // Home team underperformed expectations
    const we1 = -(c * Math.log10(1 + error));
    return [we1, -we1];
  }
}

/**
 * Update pi-ratings for both teams after a match.
 *
 * For neutral venue matches, we update BOTH home and away ratings
 * for both teams equally (since neither team has a venue advantage).
 */
export function updatePiRatings(
  homeTeam: PiTeamRatings,
  awayTeam: PiTeamRatings,
  homeScore: number,
  awayScore: number,
  params: PiParams,
  neutralVenue: boolean
): { homeTeam: PiTeamRatings; awayTeam: PiTeamRatings } {
  const observedGD = homeScore - awayScore;

  if (neutralVenue) {
    // For neutral venues, use average of home+away ratings for both teams
    const homeAvg = (homeTeam.home + homeTeam.away) / 2;
    const awayAvg = (awayTeam.home + awayTeam.away) / 2;
    const egd = expectedGoalDiff(homeAvg, awayAvg, params.c);
    const [weHome, weAway] = getWeightedError(params.c, observedGD, egd);

    // Update both home and away ratings equally for neutral
    const halfMu = params.mu1 * 0.5;
    return {
      homeTeam: {
        home: homeTeam.home + weHome * halfMu,
        away: homeTeam.away + weHome * halfMu,
      },
      awayTeam: {
        home: awayTeam.home + weAway * halfMu,
        away: awayTeam.away + weAway * halfMu,
      },
    };
  }

  // Standard home/away match
  const egd = expectedGoalDiff(homeTeam.home, awayTeam.away, params.c);
  const [weHome, weAway] = getWeightedError(params.c, observedGD, egd);

  // Update direct ratings
  const newHomeHome = homeTeam.home + weHome * params.mu1;
  const newAwayAway = awayTeam.away + weAway * params.mu1;

  // Cross-context: home result nudges away rating, and vice versa
  const newHomeAway = homeTeam.away + (newHomeHome - homeTeam.home) * params.mu2;
  const newAwayHome = awayTeam.home + (newAwayAway - awayTeam.away) * params.mu2;

  return {
    homeTeam: { home: newHomeHome, away: newHomeAway },
    awayTeam: { home: newAwayHome, away: newAwayAway },
  };
}

/**
 * Compute an overall pi-rating from home and away components.
 * Simple average — the "neutral venue" strength estimate.
 */
export function piOverall(ratings: PiTeamRatings): number {
  return (ratings.home + ratings.away) / 2;
}

/**
 * Apply annual mean reversion to pi-ratings.
 * Pull toward 0 (the mean) by a given rate.
 */
export function applyPiMeanReversion(
  ratings: PiTeamRatings,
  rate: number
): PiTeamRatings {
  return {
    home: ratings.home * (1 - rate),
    away: ratings.away * (1 - rate),
  };
}
