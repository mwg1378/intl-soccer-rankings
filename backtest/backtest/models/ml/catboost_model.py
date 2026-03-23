"""Model 25: CatBoost — Published state-of-art (55.8% accuracy in literature)."""

from backtest.models.ml.ml_base import MLBase


class CatBoostModel(MLBase):
    name = "CatBoost"

    def _create_model(self):
        try:
            from catboost import CatBoostClassifier
            return CatBoostClassifier(
                iterations=300,
                depth=6,
                learning_rate=0.05,
                l2_leaf_reg=3,
                random_seed=42,
                verbose=0,
                loss_function="MultiClass",
            )
        except (ImportError, Exception):
            # Fall back to sklearn GradientBoosting if CatBoost unavailable
            from sklearn.ensemble import GradientBoostingClassifier
            return GradientBoostingClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                random_state=42,
            )
