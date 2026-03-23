"""Model 23: Random Forest — 500 trees, max_depth=8."""

from backtest.models.ml.ml_base import MLBase


class RandomForestModel(MLBase):
    name = "Random Forest"

    def _create_model(self):
        from sklearn.ensemble import RandomForestClassifier
        return RandomForestClassifier(
            n_estimators=500,
            max_depth=8,
            min_samples_leaf=10,
            n_jobs=-1,
            random_state=42,
        )
