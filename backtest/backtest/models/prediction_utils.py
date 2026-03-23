"""Shared prediction utilities: Poisson PMF, Dixon-Coles tau, rating→xG conversion.

Ported from lib/prediction-engine.ts. Used by all models to convert their
internal ratings/parameters into the standard 5-output Prediction format.
"""

import math
from typing import Optional

from backtest.models.base import Prediction

# --- Constants (from TypeScript prediction engine) ---

BASELINE_GOALS: dict[str, float] = {
    "FRIENDLY": 1.42,
    "NATIONS_LEAGUE": 1.38,
    "QUALIFIER": 1.32,
    "TOURNAMENT_GROUP": 1.30,
    "TOURNAMENT_KNOCKOUT": 1.18,
}
DEFAULT_BASELINE = 1.35

HOME_ADVANTAGE = 1.22
SENSITIVITY = 0.30
RHO = -0.06

DIAGONAL_INFLATION: dict[str, float] = {
    "FRIENDLY": 1.10,
    "NATIONS_LEAGUE": 1.08,
    "QUALIFIER": 1.08,
    "TOURNAMENT_GROUP": 1.10,
    "TOURNAMENT_KNOCKOUT": 1.02,
}
DEFAULT_DIAGONAL = 1.08

MAX_GOALS = 10


def poisson_pmf(k: int, lam: float) -> float:
    """Compute Poisson probability: P(X = k) = (lambda^k * e^-lambda) / k!"""
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    log_p = -lam + k * math.log(lam)
    for i in range(2, k + 1):
        log_p -= math.log(i)
    return math.exp(log_p)


def dixon_coles_tau(
    home_goals: int, away_goals: int,
    lambda_home: float, lambda_away: float,
    rho: float,
) -> float:
    """Dixon-Coles correction factor for low-scoring outcomes."""
    if home_goals == 0 and away_goals == 0:
        return 1 - lambda_home * lambda_away * rho
    if home_goals == 0 and away_goals == 1:
        return 1 + lambda_home * rho
    if home_goals == 1 and away_goals == 0:
        return 1 + lambda_away * rho
    if home_goals == 1 and away_goals == 1:
        return 1 - rho
    return 1.0


def build_score_matrix(
    lambda_home: float,
    lambda_away: float,
    rho: float = RHO,
    diagonal: float = DEFAULT_DIAGONAL,
    max_goals: int = MAX_GOALS,
) -> list[list[float]]:
    """Build normalized score probability matrix with Dixon-Coles corrections."""
    matrix = [[0.0] * (max_goals + 1) for _ in range(max_goals + 1)]
    total = 0.0

    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            p = (poisson_pmf(h, lambda_home)
                 * poisson_pmf(a, lambda_away)
                 * dixon_coles_tau(h, a, lambda_home, lambda_away, rho))
            if h == a:
                p *= diagonal
            matrix[h][a] = p
            total += p

    if total > 0:
        for h in range(max_goals + 1):
            for a in range(max_goals + 1):
                matrix[h][a] /= total

    return matrix


def matrix_to_prediction(
    matrix: list[list[float]],
    lambda_home: float,
    lambda_away: float,
) -> Prediction:
    """Convert a score matrix to a Prediction object."""
    home_win = draw = away_win = 0.0
    max_goals = len(matrix) - 1

    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            if h > a:
                home_win += matrix[h][a]
            elif h == a:
                draw += matrix[h][a]
            else:
                away_win += matrix[h][a]

    return Prediction(
        home_win_prob=home_win,
        draw_prob=draw,
        away_win_prob=away_win,
        home_xg=lambda_home,
        away_xg=lambda_away,
    )


def predict_from_ratings(
    home_off: float, home_def: float,
    away_off: float, away_def: float,
    avg_off: float, std_off: float,
    avg_def: float, std_def: float,
    neutral: bool,
    importance: str,
    home_advantage: float = HOME_ADVANTAGE,
    sensitivity: float = SENSITIVITY,
    rho: float = RHO,
) -> Prediction:
    """Generate a prediction from Elo-style offensive/defensive ratings.

    This is the shared layer used by rating-only models (Elo variants,
    Glicko, TrueSkill) to produce all 5 prediction outputs.
    """
    # Z-score standardization
    z_off_home = (home_off - avg_off) / std_off if std_off > 0 else 0.0
    z_def_home = (home_def - avg_def) / std_def if std_def > 0 else 0.0
    z_off_away = (away_off - avg_off) / std_off if std_off > 0 else 0.0
    z_def_away = (away_def - avg_def) / std_def if std_def > 0 else 0.0

    baseline = BASELINE_GOALS.get(importance, DEFAULT_BASELINE)
    diagonal = DIAGONAL_INFLATION.get(importance, DEFAULT_DIAGONAL)
    ha_mult = 1.0 if neutral else home_advantage

    lambda_home = baseline * math.exp(sensitivity * (z_off_home + z_def_away)) * ha_mult
    lambda_away = baseline * math.exp(sensitivity * (z_off_away + z_def_home))

    lambda_home = max(0.15, min(lambda_home, 6.0))
    lambda_away = max(0.15, min(lambda_away, 6.0))

    matrix = build_score_matrix(lambda_home, lambda_away, rho, diagonal)
    return matrix_to_prediction(matrix, lambda_home, lambda_away)


def predict_from_single_rating(
    home_rating: float,
    away_rating: float,
    all_ratings: dict[str, float],
    neutral: bool,
    importance: str,
    home_advantage: float = HOME_ADVANTAGE,
) -> Prediction:
    """Generate a prediction from a single-dimension rating (BT, Glicko, TrueSkill).

    Converts single rating to pseudo-offensive/defensive by treating rating
    as overall strength centered at 1500.
    """
    if all_ratings:
        vals = list(all_ratings.values())
        mean_r = sum(vals) / len(vals)
        std_r = (sum((v - mean_r) ** 2 for v in vals) / len(vals)) ** 0.5 if len(vals) > 1 else 150.0
    else:
        mean_r = 1500.0
        std_r = 150.0

    std_r = max(std_r, 50.0)

    # Map single rating to off/def: higher rating = better offense AND better defense
    # Offense = rating (higher = better), Defense = 3000 - rating (lower = better defense)
    return predict_from_ratings(
        home_off=home_rating,
        home_def=3000 - home_rating,
        away_off=away_rating,
        away_def=3000 - away_rating,
        avg_off=mean_r,
        std_off=std_r,
        avg_def=3000 - mean_r,
        std_def=std_r,
        neutral=neutral,
        importance=importance,
        home_advantage=home_advantage,
    )


def predict_from_lambdas(
    lambda_home: float,
    lambda_away: float,
    importance: str = "TOURNAMENT_GROUP",
    rho: float = RHO,
) -> Prediction:
    """Generate a prediction directly from expected goals (for Poisson-family models)."""
    lambda_home = max(0.15, min(lambda_home, 6.0))
    lambda_away = max(0.15, min(lambda_away, 6.0))

    diagonal = DIAGONAL_INFLATION.get(importance, DEFAULT_DIAGONAL)
    matrix = build_score_matrix(lambda_home, lambda_away, rho, diagonal)
    return matrix_to_prediction(matrix, lambda_home, lambda_away)
