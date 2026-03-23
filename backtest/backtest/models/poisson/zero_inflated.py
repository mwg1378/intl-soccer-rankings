"""Model 9: Zero-Inflated Poisson — Extra mass at 0 goals for defensive matches."""

import math
from backtest.data.loader import MatchRecord
from backtest.models.base import Prediction
from backtest.models.poisson.poisson_base import PoissonBase
from backtest.models.prediction_utils import (
    poisson_pmf, dixon_coles_tau, DIAGONAL_INFLATION, DEFAULT_DIAGONAL,
    MAX_GOALS, RHO,
)


class ZeroInflatedPoisson(PoissonBase):
    name = "Zero-Inflated Poisson"

    def __init__(self) -> None:
        super().__init__()
        self.zero_prob: float = 0.05  # probability of structural zero

    def reset(self) -> None:
        super().reset()
        self.zero_prob = 0.05

    def train(self, matches: list[MatchRecord]) -> None:
        super().train(matches)
        # Estimate zero-inflation from data
        if not matches:
            return
        zero_count = 0
        total_teams = 0
        for m in matches[-3000:]:
            if m.home_score == 0:
                zero_count += 1
            if m.away_score == 0:
                zero_count += 1
            total_teams += 2

        observed_zero_rate = zero_count / total_teams if total_teams > 0 else 0.0
        # Expected zero rate under Poisson with avg_goals
        expected_zero_rate = math.exp(-self.avg_goals)
        # Excess zeros = structural zeros
        if observed_zero_rate > expected_zero_rate:
            self.zero_prob = min(observed_zero_rate - expected_zero_rate, 0.15)
        else:
            self.zero_prob = 0.0

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        lh, la = self._compute_lambdas(home, away, neutral)
        pi = self.zero_prob
        diagonal = DIAGONAL_INFLATION.get(importance, DEFAULT_DIAGONAL)

        matrix = [[0.0] * (MAX_GOALS + 1) for _ in range(MAX_GOALS + 1)]
        total = 0.0

        for h in range(MAX_GOALS + 1):
            for a in range(MAX_GOALS + 1):
                # ZIP: P(X=x) = pi * I(x=0) + (1-pi) * Poisson(x; lambda)
                ph = pi * (1.0 if h == 0 else 0.0) + (1 - pi) * poisson_pmf(h, lh)
                pa = pi * (1.0 if a == 0 else 0.0) + (1 - pi) * poisson_pmf(a, la)
                p = ph * pa * dixon_coles_tau(h, a, lh, la, RHO)
                if h == a:
                    p *= diagonal
                matrix[h][a] = p
                total += p

        if total > 0:
            for h in range(MAX_GOALS + 1):
                for a in range(MAX_GOALS + 1):
                    matrix[h][a] /= total

        home_win = draw = away_win = 0.0
        for h in range(MAX_GOALS + 1):
            for a in range(MAX_GOALS + 1):
                if h > a:
                    home_win += matrix[h][a]
                elif h == a:
                    draw += matrix[h][a]
                else:
                    away_win += matrix[h][a]

        return Prediction(home_win_prob=home_win, draw_prob=draw, away_win_prob=away_win,
                         home_xg=lh, away_xg=la)
