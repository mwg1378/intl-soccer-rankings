"""Model 22: Logistic Regression (L1) — Sparse baseline, interpretable coefficients."""

from backtest.models.ml.ml_base import MLBase


class LogisticL1(MLBase):
    name = "Logistic Regression (L1)"

    def _create_model(self):
        from sklearn.linear_model import LogisticRegression
        return LogisticRegression(
            penalty="l1",
            solver="saga",
            C=1.0,
            max_iter=1000,
            multi_class="multinomial",
        )
