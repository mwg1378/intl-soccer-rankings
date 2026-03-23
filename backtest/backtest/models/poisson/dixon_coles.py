"""Model 7: Dixon-Coles — Correlated low-score adjustment (rho parameter)."""

from backtest.models.poisson.poisson_base import PoissonBase


class DixonColes(PoissonBase):
    name = "Dixon-Coles"
    # Uses the default predict() from PoissonBase which includes rho=-0.06
