/**
 * Berrar k-NN Rating Engine
 *
 * Combines an Elo base rating with k-NN adjustments:
 * when predicting a match, each team's recent performance against
 * opponents of similar strength modifies the prediction.
 *
 * Inspired by the 2017 Soccer Prediction Challenge approach.
 *
 * Top performer in backtesting: Brier=0.5396, 58.8% accuracy across
 * 2,083 tournament matches (2013-2024).
 */

const K_NN = 10; // number of nearest neighbors
const K_ELO = 20; // fixed Elo K-factor
const MAX_HISTORY = 50; // max matches stored per team
const MEAN_RATING = 1500;
const MEAN_REVERSION_RATE = 0.08;

export interface BerrarState {
  rating: number;
  history: Array<{ oppRating: number; w: number; weight: number }>;
}

export interface BerrarResult {
  home: BerrarState;
  away: BerrarState;
}

/**
 * Initialize a new team's Berrar state.
 */
export function initBerrar(): BerrarState {
  return { rating: MEAN_RATING, history: [] };
}

/**
 * Process a single match: update Elo and record history.
 */
export function processBerrarMatch(
  homeState: BerrarState,
  awayState: BerrarState,
  homeScore: number,
  awayScore: number,
  homeScorePenalties?: number | null,
  awayScorePenalties?: number | null
): BerrarResult {
  const hr = homeState.rating;
  const ar = awayState.rating;

  // Expected result (600-point scale)
  const we = 1.0 / (1.0 + Math.pow(10, (ar - hr) / 600));

  // Actual W
  let wH: number;
  let wA: number;
  if (homeScore > awayScore) {
    wH = 1.0;
    wA = 0.0;
  } else if (homeScore < awayScore) {
    wH = 0.0;
    wA = 1.0;
  } else if (
    homeScorePenalties != null &&
    awayScorePenalties != null
  ) {
    wH = homeScorePenalties > awayScorePenalties ? 0.75 : 0.5;
    wA = 1.0 - wH + 0.5; // PSO loser gets 0.5
    // Correct: winner 0.75, loser 0.5
    if (homeScorePenalties > awayScorePenalties) {
      wH = 0.75;
      wA = 0.5;
    } else {
      wH = 0.5;
      wA = 0.75;
    }
  } else {
    wH = 0.5;
    wA = 0.5;
  }

  // Elo update
  const newHomeRating = hr + K_ELO * (wH - we);
  const newAwayRating = ar + K_ELO * (wA - (1 - we));

  // Add to history (keep last MAX_HISTORY)
  const newHomeHistory = [
    ...homeState.history,
    { oppRating: ar, w: wH, weight: 1.0 },
  ].slice(-MAX_HISTORY);

  const newAwayHistory = [
    ...awayState.history,
    { oppRating: hr, w: wA, weight: 1.0 },
  ].slice(-MAX_HISTORY);

  return {
    home: { rating: newHomeRating, history: newHomeHistory },
    away: { rating: newAwayRating, history: newAwayHistory },
  };
}

/**
 * Get k-NN adjustment based on performance vs similar-strength opponents.
 */
export function knnAdjustment(
  state: BerrarState,
  opponentRating: number
): number {
  if (state.history.length < 3) return 0;

  // Sort by distance to current opponent rating
  const scored = state.history
    .map((h) => ({
      dist: Math.abs(h.oppRating - opponentRating),
      w: h.w,
      weight: h.weight,
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, K_NN);

  if (scored.length === 0) return 0;

  let totalW = 0;
  let totalWeight = 0;
  for (const s of scored) {
    const kernelWeight = 1.0 / (1.0 + s.dist / 100.0);
    totalW += s.w * s.weight * kernelWeight;
    totalWeight += s.weight * kernelWeight;
  }

  if (totalWeight < 0.01) return 0;

  const avgW = totalW / totalWeight;
  return (avgW - 0.5) * 30.0; // scale to Elo points
}

/**
 * Get the effective rating for prediction (base + k-NN adjustment).
 */
export function effectiveRating(
  state: BerrarState,
  opponentRating: number
): number {
  return state.rating + knnAdjustment(state, opponentRating);
}

/**
 * Apply annual mean reversion.
 */
export function applyBerrarReversion(state: BerrarState): BerrarState {
  return {
    rating:
      state.rating + (MEAN_RATING - state.rating) * MEAN_REVERSION_RATE,
    history: state.history.map((h) => ({
      ...h,
      weight: h.weight * 0.85, // decay historical weights
    })),
  };
}
