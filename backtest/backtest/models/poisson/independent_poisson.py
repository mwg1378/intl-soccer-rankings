"""Model 6: Independent Poisson (Maher 1982) — baseline independent Poisson per team."""

from backtest.models.poisson.poisson_base import PoissonBase


class IndependentPoisson(PoissonBase):
    name = "Independent Poisson"

    def predict(self, home: str, away: str, neutral: bool, importance: str):
        from backtest.models.prediction_utils import predict_from_lambdas
        lh, la = self._compute_lambdas(home, away, neutral)
        # No Dixon-Coles correction (rho=0)
        return predict_from_lambdas(lh, la, importance, rho=0.0)
