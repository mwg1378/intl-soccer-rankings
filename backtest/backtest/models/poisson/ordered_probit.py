"""Model 11: Ordered Probit — Models goal difference directly as ordinal outcome."""

import math
from collections import defaultdict
from datetime import date
from typing import Optional

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import BASELINE_GOALS, DEFAULT_BASELINE

HALF_LIFE_DAYS = 730


def norm_cdf(x: float) -> float:
    """Standard normal CDF using the error function."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2)))


class OrderedProbit(BaseModel):
    name = "Ordered Probit"

    def __init__(self) -> None:
        self.strength: dict[str, float] = {}
        self.home_adv: float = 0.3
        # Cutpoints for goal difference categories: ..., -3, -2, -1, 0, 1, 2, 3, ...
        # We model P(GD <= k) = Phi(cutpoint[k] - mu)
        self.cutpoints: list[float] = [-2.5, -1.5, -0.8, 0.0, 0.8, 1.5, 2.5]
        self._ref_date: Optional[date] = None

    def reset(self) -> None:
        self.strength.clear()
        self.home_adv = 0.3
        self.cutpoints = [-2.5, -1.5, -0.8, 0.0, 0.8, 1.5, 2.5]
        self._ref_date = None

    def _time_weight(self, match_date: date) -> float:
        if self._ref_date is None:
            return 1.0
        days = (self._ref_date - match_date).days
        if days <= 0:
            return 1.0
        return 0.5 ** (days / HALF_LIFE_DAYS)

    def train(self, matches: list[MatchRecord]) -> None:
        if not matches:
            return

        self._ref_date = matches[-1].date

        teams: set[str] = set()
        for m in matches:
            teams.add(m.home_team)
            teams.add(m.away_team)

        for t in teams:
            self.strength[t] = 0.0

        # Simple gradient-based fitting
        for iteration in range(30):
            grad = defaultdict(float)
            grad_count = defaultdict(float)

            for m in matches:
                w = self._time_weight(m.date)
                if w < 0.01:
                    continue

                ha = 0.0 if m.neutral else self.home_adv
                mu = self.strength.get(m.home_team, 0.0) - self.strength.get(m.away_team, 0.0) + ha
                actual_gd = m.home_score - m.away_score
                clamped_gd = max(-3, min(3, actual_gd))

                # Gradient: push strength toward predicting actual GD
                error = clamped_gd - mu
                grad[m.home_team] += w * error * 0.1
                grad[m.away_team] -= w * error * 0.1
                grad_count[m.home_team] += w
                grad_count[m.away_team] += w

            # Update
            for t in teams:
                if grad_count[t] > 0:
                    self.strength[t] += grad[t] / grad_count[t]

            # Center
            avg = sum(self.strength[t] for t in teams) / len(teams) if teams else 0
            for t in teams:
                self.strength[t] -= avg

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        ha = 0.0 if neutral else self.home_adv
        mu = self.strength.get(home, 0.0) - self.strength.get(away, 0.0) + ha

        # Goal diff probabilities from ordered probit
        # Categories: GD <= -3, -2, -1, 0, 1, 2, 3, >= 4
        probs = []
        prev_cdf = 0.0
        for cp in self.cutpoints:
            cdf = norm_cdf(cp - mu)
            probs.append(max(0, cdf - prev_cdf))
            prev_cdf = cdf
        probs.append(max(0, 1.0 - prev_cdf))

        # Map to W/D/L: indices 0-2 = away win (GD <= -1), 3 = draw (GD=0), 4-7 = home win (GD >= 1)
        away_win = sum(probs[:3])
        draw = probs[3]
        home_win = sum(probs[4:])

        # Normalize
        total = home_win + draw + away_win
        if total > 0:
            home_win /= total
            draw /= total
            away_win /= total

        # Expected goals from baseline + strength difference
        baseline = BASELINE_GOALS.get(importance, DEFAULT_BASELINE)
        home_xg = baseline + mu * 0.3
        away_xg = baseline - mu * 0.3
        home_xg = max(0.15, min(home_xg, 6.0))
        away_xg = max(0.15, min(away_xg, 6.0))

        return Prediction(
            home_win_prob=home_win, draw_prob=draw, away_win_prob=away_win,
            home_xg=home_xg, away_xg=away_xg,
        )
