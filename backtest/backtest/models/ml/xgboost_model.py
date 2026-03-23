"""Model 24: XGBoost — 2017 Challenge winner approach, early stopping."""

from backtest.models.ml.ml_base import MLBase


class XGBoostModel(MLBase):
    name = "XGBoost"

    def _create_model(self):
        try:
            from xgboost import XGBClassifier
            return XGBClassifier(
                n_estimators=300,
                max_depth=6,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=5,
                objective="multi:softprob",
                eval_metric="mlogloss",
                random_state=42,
                verbosity=0,
            )
        except (ImportError, Exception):
            # Fall back to sklearn GradientBoosting if XGBoost unavailable
            from sklearn.ensemble import GradientBoostingClassifier
            return GradientBoostingClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                random_state=42,
            )
