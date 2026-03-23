/**
 * Importance-Weighted Pi-Ratings Engine
 *
 * Extends Constantinou & Fenton's Pi-ratings by scaling the learning rate
 * based on match importance. World Cup matches produce larger updates than
 * friendlies, giving more weight to competitive results.
 *
 * #1 composite score in backtesting: Brier=0.5363, 57.6% accuracy,
 * MarginMAE=1.259 across 2,083 tournament matches (2013-2024).
 */

export interface IwPiTeamRatings {
  home: number;
  away: number;
}

// Importance multipliers (World Cup knockout = 1.5x, friendly = 0.5x)
const IMPORTANCE_WEIGHT: Record<string, number> = {
  FRIENDLY: 0.5,
  NATIONS_LEAGUE: 0.75,
  QUALIFIER: 1.0,
  TOURNAMENT_GROUP: 1.25,
  TOURNAMENT_KNOCKOUT: 1.5,
};

const C = 3.0;
const MU1 = 0.1;
const MU2 = 0.3;

export function initIwPi(): IwPiTeamRatings {
  return { home: 0, away: 0 };
}

export function iwPiOverall(ratings: IwPiTeamRatings): number {
  return (ratings.home + ratings.away) / 2;
}

function ratingToExpectedGoals(rating: number): number {
  if (rating >= 0) {
    return Math.pow(10, Math.abs(rating) / C) - 1;
  }
  return -(Math.pow(10, Math.abs(rating) / C) - 1);
}

function expectedGoalDiff(homeRating: number, awayRating: number): number {
  return ratingToExpectedGoals(homeRating) - ratingToExpectedGoals(awayRating);
}

/**
 * Update importance-weighted pi-ratings after a match.
 */
export function updateIwPiRatings(
  homeTeam: IwPiTeamRatings,
  awayTeam: IwPiTeamRatings,
  homeScore: number,
  awayScore: number,
  neutralVenue: boolean,
  importance: string,
): { homeTeam: IwPiTeamRatings; awayTeam: IwPiTeamRatings } {
  const observedGD = homeScore - awayScore;
  const importanceW = IMPORTANCE_WEIGHT[importance] ?? 1.0;

  if (neutralVenue) {
    const homeAvg = (homeTeam.home + homeTeam.away) / 2;
    const awayAvg = (awayTeam.home + awayTeam.away) / 2;
    const egd = expectedGoalDiff(homeAvg, awayAvg);
    const error = Math.abs(observedGD - egd);
    let we = C * Math.log10(1 + error);
    if (egd >= observedGD) we = -we;

    const scaledMu = MU1 * importanceW * 0.5;
    return {
      homeTeam: {
        home: homeTeam.home + we * scaledMu,
        away: homeTeam.away + we * scaledMu,
      },
      awayTeam: {
        home: awayTeam.home - we * scaledMu,
        away: awayTeam.away - we * scaledMu,
      },
    };
  }

  // Standard home/away match
  const egd = expectedGoalDiff(homeTeam.home, awayTeam.away);
  const error = Math.abs(observedGD - egd);
  let we = C * Math.log10(1 + error);
  if (egd >= observedGD) we = -we;

  const scaledMu1 = MU1 * importanceW;
  const newHomeHome = homeTeam.home + we * scaledMu1;
  const newAwayAway = awayTeam.away - we * scaledMu1;

  // Cross-context learning
  const newHomeAway = homeTeam.away + (newHomeHome - homeTeam.home) * MU2;
  const newAwayHome = awayTeam.home + (newAwayAway - awayTeam.away) * MU2;

  return {
    homeTeam: { home: newHomeHome, away: newHomeAway },
    awayTeam: { home: newAwayHome, away: newAwayAway },
  };
}

/**
 * Apply annual mean reversion toward 0.
 */
export function applyIwPiMeanReversion(
  ratings: IwPiTeamRatings,
  rate: number = 0.08,
): IwPiTeamRatings {
  return {
    home: ratings.home * (1 - rate),
    away: ratings.away * (1 - rate),
  };
}
