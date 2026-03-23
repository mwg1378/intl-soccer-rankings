/**
 * Composite Rating Engines — Market-aligned blended rankings.
 *
 * These composites were designed by running Monte Carlo World Cup 2026
 * simulations with each individual ranking model, comparing the resulting
 * championship probabilities against sportsbook consensus odds (FanDuel/
 * DraftKings/bet365, March 2026), and optimizing blend weights to minimize
 * the mean squared error between model-implied and market-implied odds.
 *
 * ## How They Were Created
 *
 * 1. Ran 5,000-iteration WC simulations for each of 9 individual ranking
 *    models (Elo, BT, Glicko-2, Berrar, Pi, IW-Pi, MO-Elo, OP, Combined).
 * 2. Extracted championship probabilities from each simulation.
 * 3. Compared against market consensus odds using MSE, KL divergence,
 *    Spearman rank correlation, and top-5 team overlap.
 * 4. Grid-searched all pairs of top-5 models at 10% weight increments
 *    to find the optimal 2-model blend.
 *
 * ## Individual Model Market Alignment (MSE, lower = better)
 *
 * | Model              | MSE      | Correlation | Top-5 |
 * |--------------------|----------|-------------|-------|
 * | Combined (Elo+Rst) | 0.000397 | 0.824       | 80%   |
 * | Bradley-Terry      | 0.000545 | 0.891       | 80%   |
 * | Ordered Probit     | 0.000725 | 0.727       | 40%   |
 * | Glicko-2           | 0.000729 | 0.798       | 60%   |
 * | Pi-Ratings         | 0.000755 | 0.737       | 60%   |
 *
 * ## Composite Market Alignment
 *
 * | Composite          | MSE      | Correlation | Top-5 |
 * |--------------------|----------|-------------|-------|
 * | Grid-Optimized     | 0.000274 | 0.907       | 100%  |
 * | Top-3 Equal        | 0.000438 | 0.877       | 80%   |
 * | Backtested+Market  | 0.000484 | 0.808       | 80%   |
 */

// --- Composite 1: Grid-Optimized Blend ---
// 70% Combined (Elo+Roster) + 30% Bradley-Terry
// Best market fit: MSE=0.000274, Corr=0.907, 100% top-5 overlap
// The Combined rating already blends match-based Elo with EA FC roster quality,
// and BT adds equilibrium-based strength estimation with time decay. Together
// they produce championship odds closest to what sportsbooks price.

export function gridOptimizedRating(
  combinedOff: number, combinedDef: number,
  btRating: number,
): { offensive: number; defensive: number; overall: number } {
  const btOff = btRating;
  const btDef = 3000 - btRating;
  const offensive = 0.7 * combinedOff + 0.3 * btOff;
  const defensive = 0.7 * combinedDef + 0.3 * btDef;
  return { offensive, defensive, overall: (offensive + (3000 - defensive)) / 2 };
}

// --- Composite 2: Top-3 Equal Blend ---
// Equal-weight average of the 3 best market-aligned individual models:
// Combined (Elo+Roster) + Bradley-Terry + Ordered Probit
// MSE=0.000438, Corr=0.877, 80% top-5 overlap
// Simple ensemble that avoids overfitting to any single model. The three
// models represent fundamentally different approaches: sequential Elo,
// equilibrium MLE, and ordinal regression on goal difference.

export function top3EqualRating(
  combinedOff: number, combinedDef: number,
  btRating: number,
  opRating: number,
): { offensive: number; defensive: number; overall: number } {
  const btOff = btRating;
  const btDef = 3000 - btRating;
  const opOff = opRating;
  const opDef = 3000 - opRating;
  const offensive = (combinedOff + btOff + opOff) / 3;
  const defensive = (combinedDef + btDef + opDef) / 3;
  return { offensive, defensive, overall: (offensive + (3000 - defensive)) / 2 };
}

// --- Composite 3: Backtested+Market Blend ---
// 50% IW Pi-Ratings + 50% Combined (Elo+Roster)
// MSE=0.000484, Corr=0.808, 80% top-5 overlap
// Balances the best *predictive* model (IW Pi, lowest Brier score in
// backtesting) with the best *market-aligned* model (Combined). IW Pi
// captures recent competitive form; Combined captures roster talent +
// historical strength.

export function backtestedMarketRating(
  combinedOff: number, combinedDef: number,
  iwPiOverall: number,
): { offensive: number; defensive: number; overall: number } {
  const iwOff = 1500 + iwPiOverall * 100;
  const iwDef = 1500 - iwPiOverall * 100;
  const offensive = 0.5 * combinedOff + 0.5 * iwOff;
  const defensive = 0.5 * combinedDef + 0.5 * iwDef;
  return { offensive, defensive, overall: (offensive + (3000 - defensive)) / 2 };
}
