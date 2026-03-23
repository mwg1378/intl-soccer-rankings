"""Model 10: Negative Binomial — Overdispersion handling."""

import math
from backtest.data.loader import MatchRecord
from backtest.models.base import Prediction
from backtest.models.poisson.poisson_base import PoissonBase
from backtest.models.prediction_utils import (
    dixon_coles_tau, DIAGONAL_INFLATION, DEFAULT_DIAGONAL, MAX_GOALS, RHO,
)


def neg_binom_pmf(k: int, mu: float, alpha: float) -> float:
    """Negative binomial PMF parameterized by mean (mu) and dispersion (alpha).

    Var = mu + alpha * mu^2. When alpha→0, approaches Poisson.
    Uses the r, p parameterization: r = 1/alpha, p = r/(r+mu).
    """
    if mu <= 0:
        return 1.0 if k == 0 else 0.0
    if alpha <= 0:
        # Fall back to Poisson
        from backtest.models.prediction_utils import poisson_pmf
        return poisson_pmf(k, mu)

    r = 1.0 / alpha
    p = r / (r + mu)

    # log P(X=k) = log(Gamma(r+k)) - log(Gamma(r)) - log(k!) + r*log(p) + k*log(1-p)
    log_p = (math.lgamma(r + k) - math.lgamma(r) - math.lgamma(k + 1)
             + r * math.log(p) + k * math.log(1 - p))
    return math.exp(log_p)


class NegativeBinomial(PoissonBase):
    name = "Negative Binomial"

    def __init__(self) -> None:
        super().__init__()
        self.alpha: float = 0.1  # overdispersion parameter

    def reset(self) -> None:
        super().reset()
        self.alpha = 0.1

    def train(self, matches: list[MatchRecord]) -> None:
        super().train(matches)
        # Estimate overdispersion from residuals
        if not matches:
            return
        var_sum = 0.0
        mean_sum = 0.0
        count = 0
        for m in matches[-3000:]:
            lh, la = self._compute_lambdas(m.home_team, m.away_team, m.neutral)
            var_sum += (m.home_score - lh) ** 2 + (m.away_score - la) ** 2
            mean_sum += lh + la
            count += 2

        if count > 0 and mean_sum > 0:
            empirical_var = var_sum / count
            empirical_mean = mean_sum / count
            # Var = mu + alpha * mu^2 → alpha = (Var - mu) / mu^2
            if empirical_mean > 0:
                self.alpha = max(0.01, min((empirical_var - empirical_mean) / (empirical_mean ** 2), 1.0))

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        lh, la = self._compute_lambdas(home, away, neutral)
        diagonal = DIAGONAL_INFLATION.get(importance, DEFAULT_DIAGONAL)

        matrix = [[0.0] * (MAX_GOALS + 1) for _ in range(MAX_GOALS + 1)]
        total = 0.0

        for h in range(MAX_GOALS + 1):
            for a in range(MAX_GOALS + 1):
                p = (neg_binom_pmf(h, lh, self.alpha)
                     * neg_binom_pmf(a, la, self.alpha)
                     * dixon_coles_tau(h, a, lh, la, RHO))
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
