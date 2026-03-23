/**
 * Glicko-2 Rating Engine
 *
 * Rating deviation (uncertainty) + volatility tracking.
 * Each team has a rating, RD (uncertainty), and volatility.
 * Matches within a "rating period" (month) are processed as a batch.
 *
 * Adapted for soccer with draw handling (draws = 0.5 score).
 * PSO: winner gets 0.75, loser 0.25.
 *
 * Top performer in backtesting: Brier=0.5408, 59.3% accuracy across
 * 2,083 tournament matches (2013-2024).
 */

const TAU = 0.5; // system volatility constant
const EPSILON = 0.000001;
const SCALE_FACTOR = 173.7178; // 400 / ln(10)
const INITIAL_MU = 0; // 1500 on Glicko-1 scale
const INITIAL_RD = 2.0; // ~350 on Glicko-1 scale
const INITIAL_VOL = 0.06;
const MAX_RD = 2.5;

export interface GlickoState {
  mu: number; // Glicko-2 scale rating
  rd: number; // rating deviation
  vol: number; // volatility
}

export interface GlickoResult {
  home: GlickoState;
  away: GlickoState;
}

function g(rd: number): number {
  return 1.0 / Math.sqrt(1.0 + 3.0 * rd * rd / (Math.PI * Math.PI));
}

function e(mu: number, muJ: number, rdJ: number): number {
  return 1.0 / (1.0 + Math.exp(-g(rdJ) * (mu - muJ)));
}

/**
 * Initialize a new team's Glicko-2 state.
 */
export function initGlicko(): GlickoState {
  return { mu: INITIAL_MU, rd: INITIAL_RD, vol: INITIAL_VOL };
}

/**
 * Convert Glicko-2 internal rating to 1500-centered display scale.
 */
export function glickoToDisplay(state: GlickoState): number {
  return state.mu * SCALE_FACTOR + 1500;
}

/**
 * Convert RD to display scale (approximate Elo-equivalent uncertainty).
 */
export function rdToDisplay(state: GlickoState): number {
  return state.rd * SCALE_FACTOR;
}

/**
 * Increase RD for inactivity at period boundaries.
 */
export function applyRdIncrease(state: GlickoState): GlickoState {
  const newRd = Math.sqrt(state.rd ** 2 + state.vol ** 2);
  return { ...state, rd: Math.min(newRd, MAX_RD) };
}

/**
 * Update a team's Glicko-2 state based on a set of match results in a period.
 *
 * @param team - current team state
 * @param opponents - array of [opponent_state, score] where score is 0-1
 */
export function updateGlicko(
  team: GlickoState,
  opponents: Array<[GlickoState, number]>
): GlickoState {
  if (opponents.length === 0) return team;

  const { mu, rd, vol } = team;

  // Step 3: Compute v (estimated variance)
  let vInv = 0;
  let deltaSum = 0;
  for (const [opp, score] of opponents) {
    const gVal = g(opp.rd);
    const eVal = e(mu, opp.mu, opp.rd);
    vInv += gVal * gVal * eVal * (1 - eVal);
    deltaSum += gVal * (score - eVal);
  }

  if (vInv < EPSILON) return team;

  const v = 1.0 / vInv;
  const delta = v * deltaSum;

  // Step 4: Compute new volatility (Illinois algorithm)
  const a = Math.log(vol * vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (
      (ex * (delta * delta - rd * rd - v - ex)) /
      (2.0 * (rd * rd + v + ex) ** 2) -
      (x - a) / (TAU * TAU)
    );
  };

  let A = a;
  let B: number;
  if (delta * delta > rd * rd + v) {
    B = Math.log(delta * delta - rd * rd - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0 && k < 100) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 50; i++) {
    if (Math.abs(B - A) < EPSILON) break;
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2.0;
    }
    B = C;
    fB = fC;
  }

  const newVol = Math.exp(A / 2.0);

  // Step 5-6: Update RD and mu
  const rdStar = Math.sqrt(rd * rd + newVol * newVol);
  const newRd = 1.0 / Math.sqrt(1.0 / (rdStar * rdStar) + vInv);
  const newMu = mu + newRd * newRd * deltaSum;

  return {
    mu: newMu,
    rd: Math.min(newRd, MAX_RD),
    vol: newVol,
  };
}

/**
 * Process a single match and return updated states for both teams.
 * Simplified per-match update (treats each match as its own period).
 */
export function processMatch(
  homeState: GlickoState,
  awayState: GlickoState,
  homeScore: number,
  awayScore: number,
  homeScorePenalties?: number | null,
  awayScorePenalties?: number | null
): GlickoResult {
  let hScore: number;
  let aScore: number;

  if (homeScore > awayScore) {
    hScore = 1.0;
    aScore = 0.0;
  } else if (homeScore < awayScore) {
    hScore = 0.0;
    aScore = 1.0;
  } else if (
    homeScorePenalties != null &&
    awayScorePenalties != null
  ) {
    hScore = homeScorePenalties > awayScorePenalties ? 0.75 : 0.25;
    aScore = 1.0 - hScore;
  } else {
    hScore = 0.5;
    aScore = 0.5;
  }

  const newHome = updateGlicko(homeState, [[awayState, hScore]]);
  const newAway = updateGlicko(awayState, [[homeState, aScore]]);

  return { home: newHome, away: newAway };
}

/**
 * Apply annual mean reversion: pull RD up slightly and mu toward 0.
 */
export function applyGlickoReversion(
  state: GlickoState,
  rate: number = 0.08
): GlickoState {
  return {
    mu: state.mu * (1 - rate),
    rd: Math.min(state.rd * 1.05, MAX_RD), // slight RD increase
    vol: state.vol,
  };
}
