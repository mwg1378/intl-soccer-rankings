"""Model 8: Bivariate Poisson (Karlis-Ntzoufras) — genuine covariance parameter."""

import math
from backtest.data.loader import MatchRecord
from backtest.models.base import Prediction
from backtest.models.poisson.poisson_base import PoissonBase
from backtest.models.prediction_utils import (
    poisson_pmf, DIAGONAL_INFLATION, DEFAULT_DIAGONAL, MAX_GOALS,
)


class BivariatePoisson(PoissonBase):
    name = "Bivariate Poisson"

    def __init__(self) -> None:
        super().__init__()
        self.cov_lambda: float = 0.1  # covariance parameter

    def reset(self) -> None:
        super().reset()
        self.cov_lambda = 0.1

    def train(self, matches: list[MatchRecord]) -> None:
        super().train(matches)
        # Estimate covariance from residuals
        if not matches:
            return

        cov_sum = 0.0
        cov_count = 0.0
        for m in matches[-2000:]:  # use recent matches
            w = self._time_weight(m.date)
            if w < 0.01:
                continue
            lh, la = self._compute_lambdas(m.home_team, m.away_team, m.neutral)
            resid_h = m.home_score - lh
            resid_a = m.away_score - la
            cov_sum += w * resid_h * resid_a
            cov_count += w

        if cov_count > 0:
            self.cov_lambda = max(0.01, min(cov_sum / cov_count, 0.5))

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        lh, la = self._compute_lambdas(home, away, neutral)
        lam3 = self.cov_lambda  # shared Poisson component

        # Bivariate Poisson: P(X=x, Y=y) = sum_k P1(x-k) * P2(y-k) * P3(k)
        # where lam1 = lh - lam3, lam2 = la - lam3
        lam1 = max(0.1, lh - lam3)
        lam2 = max(0.1, la - lam3)

        diagonal = DIAGONAL_INFLATION.get(importance, DEFAULT_DIAGONAL)
        matrix = [[0.0] * (MAX_GOALS + 1) for _ in range(MAX_GOALS + 1)]
        total = 0.0

        for h in range(MAX_GOALS + 1):
            for a in range(MAX_GOALS + 1):
                p = 0.0
                for k in range(min(h, a) + 1):
                    p += (poisson_pmf(h - k, lam1)
                          * poisson_pmf(a - k, lam2)
                          * poisson_pmf(k, lam3))
                if h == a:
                    p *= diagonal
                matrix[h][a] = p
                total += p

        # Normalize
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

        return Prediction(
            home_win_prob=home_win,
            draw_prob=draw,
            away_win_prob=away_win,
            home_xg=lh,
            away_xg=la,
        )
