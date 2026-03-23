"""Model 13: TrueSkill — Bayesian with uncertainty, adapted for soccer draws."""

import math

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_single_rating

# TrueSkill parameters tuned for soccer
MU_INIT = 25.0
SIGMA_INIT = 8.333
BETA = 4.167  # performance variance
TAU = 0.083   # dynamics factor (additive per game)
DRAW_PROB = 0.26  # soccer draw probability (~26%)

SCALE = 1500.0 / MU_INIT  # convert to 1500-centered scale


def _v_w_functions(t: float, epsilon: float):
    """Truncated Gaussian helper functions for TrueSkill."""
    from math import erf, exp, pi, sqrt

    def norm_pdf(x):
        return exp(-x * x / 2.0) / sqrt(2.0 * pi)

    def norm_cdf(x):
        return 0.5 * (1.0 + erf(x / sqrt(2.0)))

    # v (mean additive update) and w (variance multiplicative update)
    denom = norm_cdf(t - epsilon) - norm_cdf(-t - epsilon)
    if denom < 1e-10:
        # Decisive result
        if t > 0:
            return norm_pdf(t - epsilon) / max(norm_cdf(t - epsilon), 1e-10), \
                   (t - epsilon) * norm_pdf(t - epsilon) / max(norm_cdf(t - epsilon), 1e-10)
        else:
            return -norm_pdf(-t - epsilon) / max(norm_cdf(-t - epsilon), 1e-10), \
                   (-t - epsilon) * norm_pdf(-t - epsilon) / max(norm_cdf(-t - epsilon), 1e-10)

    v = (norm_pdf(t - epsilon) - norm_pdf(-t - epsilon)) / denom
    w = v * v + ((t - epsilon) * norm_pdf(t - epsilon) - (-t - epsilon) * norm_pdf(-t - epsilon)) / denom
    return v, w


class TrueSkillModel(BaseModel):
    name = "TrueSkill"

    def __init__(self) -> None:
        self.mu: dict[str, float] = {}
        self.sigma: dict[str, float] = {}

    def reset(self) -> None:
        self.mu.clear()
        self.sigma.clear()

    def _ensure_team(self, team: str) -> None:
        if team not in self.mu:
            self.mu[team] = MU_INIT
            self.sigma[team] = SIGMA_INIT

    def _to_elo(self, team: str) -> float:
        return self.mu.get(team, MU_INIT) * SCALE

    def _update(self, winner: str, loser: str, is_draw: bool) -> None:
        self._ensure_team(winner)
        self._ensure_team(loser)

        # Add dynamics
        sigma_w = math.sqrt(self.sigma[winner] ** 2 + TAU ** 2)
        sigma_l = math.sqrt(self.sigma[loser] ** 2 + TAU ** 2)

        c = math.sqrt(2 * BETA ** 2 + sigma_w ** 2 + sigma_l ** 2)
        t = (self.mu[winner] - self.mu[loser]) / c

        # Draw margin from draw probability
        epsilon = math.sqrt(2) * BETA * 0.7407  # calibrated for ~26% draw rate

        if is_draw:
            v, w = _v_w_functions(t, epsilon)
            # For draws, both players move toward each other
            mu_delta_w = sigma_w ** 2 / c * v * 0.5
            mu_delta_l = -sigma_l ** 2 / c * v * 0.5
            sigma_w_new = sigma_w * math.sqrt(max(1 - sigma_w ** 2 / c ** 2 * w * 0.5, 0.1))
            sigma_l_new = sigma_l * math.sqrt(max(1 - sigma_l ** 2 / c ** 2 * w * 0.5, 0.1))
        else:
            # Win/loss
            from math import erf, exp, pi, sqrt
            def norm_pdf(x):
                return exp(-x * x / 2.0) / sqrt(2.0 * pi)
            def norm_cdf(x):
                return 0.5 * (1.0 + erf(x / sqrt(2.0)))

            v_val = norm_pdf(t - epsilon) / max(norm_cdf(t - epsilon), 1e-10)
            w_val = v_val * (v_val + t - epsilon)

            mu_delta_w = sigma_w ** 2 / c * v_val
            mu_delta_l = -sigma_l ** 2 / c * v_val
            sigma_w_new = sigma_w * math.sqrt(max(1 - sigma_w ** 2 / c ** 2 * w_val, 0.1))
            sigma_l_new = sigma_l * math.sqrt(max(1 - sigma_l ** 2 / c ** 2 * w_val, 0.1))

        self.mu[winner] += mu_delta_w
        self.mu[loser] += mu_delta_l
        self.sigma[winner] = max(sigma_w_new, 0.5)
        self.sigma[loser] = max(sigma_l_new, 0.5)

    def train(self, matches: list[MatchRecord]) -> None:
        for m in matches:
            self._ensure_team(m.home_team)
            self._ensure_team(m.away_team)

            if m.home_score > m.away_score:
                self._update(m.home_team, m.away_team, is_draw=False)
            elif m.away_score > m.home_score:
                self._update(m.away_team, m.home_team, is_draw=False)
            else:
                # Draw — treat home team as "winner" for ordering (symmetric)
                self._update(m.home_team, m.away_team, is_draw=True)

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        self._ensure_team(home)
        self._ensure_team(away)

        all_ratings = {t: self._to_elo(t) for t in self.mu}
        return predict_from_single_rating(
            home_rating=self._to_elo(home),
            away_rating=self._to_elo(away),
            all_ratings=all_ratings,
            neutral=neutral,
            importance=importance,
        )
