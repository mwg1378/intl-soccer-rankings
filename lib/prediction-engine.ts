/**
 * Prediction Engine — Dixon-Coles + Poisson score prediction model.
 *
 * Uses a log-linear model with z-score standardized ratings to compute
 * expected goals, then applies Poisson + Dixon-Coles corrections for
 * the full scoreline probability matrix.
 */

export interface TeamRatings {
  offensive: number;
  defensive: number;
}

export interface PredictionInput {
  homeTeam: TeamRatings;
  awayTeam: TeamRatings;
  neutralVenue: boolean;
  avgOffensive?: number;
  avgDefensive?: number;
  stdOffensive?: number;
  stdDefensive?: number;
}

export interface ScoreProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface PredictionResult {
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  scoreMatrix: number[][];
  topScorelines: ScoreProbability[];
}

// Average goals per team in international matches
const BASELINE_GOALS = 1.35;

// Home advantage multiplier for expected goals
const HOME_ADVANTAGE = 1.22;

// Log-linear sensitivity parameter. Controls how much rating differences
// translate into expected goal differences. Calibrated against historical
// World Cup / tournament results. Higher = more decisive favorites.
const SENSITIVITY = 0.36;

// Dixon-Coles rho parameter (typically slightly negative)
const RHO = -0.06;

// Diagonal inflation factor for draws
const DIAGONAL_INFLATION = 1.08;

// Maximum goals to compute in the matrix
const MAX_GOALS = 10;

/**
 * Compute Poisson probability: P(X = k) = (lambda^k * e^-lambda) / k!
 */
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) {
    logP -= Math.log(i);
  }
  return Math.exp(logP);
}

/**
 * Dixon-Coles correction factor (tau function).
 * Adjusts probabilities for low-scoring outcomes (0-0, 1-0, 0-1, 1-1).
 */
function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  if (homeGoals === 0 && awayGoals === 0) {
    return 1 - lambdaHome * lambdaAway * rho;
  }
  if (homeGoals === 0 && awayGoals === 1) {
    return 1 + lambdaHome * rho;
  }
  if (homeGoals === 1 && awayGoals === 0) {
    return 1 + lambdaAway * rho;
  }
  if (homeGoals === 1 && awayGoals === 1) {
    return 1 - rho;
  }
  return 1.0;
}

/**
 * Generate a full match prediction using a log-linear z-score model.
 *
 * The expected goals for each team are computed as:
 *   lambda_home = BASELINE * exp(c * (zOff_home + zDef_away)) * homeAdv
 *   lambda_away = BASELINE * exp(c * (zOff_away + zDef_home))
 *
 * where z-scores normalize ratings to standard deviations from the mean.
 * In our Elo system, higher defensive = worse defense, so positive zDef
 * means more goals conceded, which correctly combines with positive zOff
 * (better offense) to increase expected goals.
 */
export function predictMatch(input: PredictionInput): PredictionResult {
  const avgOff = input.avgOffensive ?? 1500;
  const avgDef = input.avgDefensive ?? 1500;
  // Use provided std, or estimate from typical Elo spread
  const stdOff = input.stdOffensive ?? 250;
  const stdDef = input.stdDefensive ?? 180;

  // Z-score standardization
  const zOffHome = (input.homeTeam.offensive - avgOff) / stdOff;
  const zDefHome = (input.homeTeam.defensive - avgDef) / stdDef;
  const zOffAway = (input.awayTeam.offensive - avgOff) / stdOff;
  const zDefAway = (input.awayTeam.defensive - avgDef) / stdDef;

  // Home advantage
  const homeAdvMultiplier = input.neutralVenue ? 1.0 : HOME_ADVANTAGE;

  // Log-linear expected goals
  // Home xG: good home offense (zOffHome > 0) + bad away defense (zDefAway > 0)
  let lambdaHome =
    BASELINE_GOALS *
    Math.exp(SENSITIVITY * (zOffHome + zDefAway)) *
    homeAdvMultiplier;

  // Away xG: good away offense (zOffAway > 0) + bad home defense (zDefHome > 0)
  let lambdaAway =
    BASELINE_GOALS * Math.exp(SENSITIVITY * (zOffAway + zDefHome));

  // Clamp expected goals to reasonable range
  lambdaHome = Math.max(0.15, Math.min(lambdaHome, 6.0));
  lambdaAway = Math.max(0.15, Math.min(lambdaAway, 6.0));

  // Build score probability matrix
  const matrix: number[][] = Array.from({ length: MAX_GOALS + 1 }, () =>
    Array(MAX_GOALS + 1).fill(0)
  );

  let totalProb = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      let p =
        poissonPmf(h, lambdaHome) *
        poissonPmf(a, lambdaAway) *
        dixonColesTau(h, a, lambdaHome, lambdaAway, RHO);

      // Diagonal inflation for draws
      if (h === a) {
        p *= DIAGONAL_INFLATION;
      }

      matrix[h][a] = p;
      totalProb += p;
    }
  }

  // Normalize
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      matrix[h][a] /= totalProb;
    }
  }

  // Sum up outcome probabilities
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  const scorelines: ScoreProbability[] = [];

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      if (h > a) homeWinProb += matrix[h][a];
      else if (h === a) drawProb += matrix[h][a];
      else awayWinProb += matrix[h][a];

      scorelines.push({
        homeGoals: h,
        awayGoals: a,
        probability: matrix[h][a],
      });
    }
  }

  // Top scorelines sorted by probability
  const topScorelines = scorelines
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10);

  return {
    homeExpectedGoals: lambdaHome,
    awayExpectedGoals: lambdaAway,
    homeWinProb,
    drawProb,
    awayWinProb,
    scoreMatrix: matrix,
    topScorelines,
  };
}

/**
 * Format a probability as a percentage string.
 */
export function formatProb(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}
