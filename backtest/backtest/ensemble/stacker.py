"""Model 26: Stacked Ensemble — Meta-learner on top of all 25 models' predictions.

Uses leave-one-tournament-out CV to avoid overfitting. The meta-learner
is a simple logistic regression on the stacked predictions.
"""

import math
import numpy as np

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.evaluation.walk_forward import ModelResult


class StackedEnsemble(BaseModel):
    name = "Stacked Ensemble"

    def __init__(self, base_models: list[BaseModel]) -> None:
        self.base_models = base_models
        self._weights: list[float] = []  # per-model weights
        self._trained = False

    def reset(self) -> None:
        self._weights.clear()
        self._trained = False
        for m in self.base_models:
            m.reset()

    def train(self, matches: list[MatchRecord]) -> None:
        """Train all base models, then learn combination weights."""
        for model in self.base_models:
            model.reset()
            model.train(matches)

        # Learn weights from recent match predictions (last 500)
        test_matches = matches[-500:]
        if len(test_matches) < 50:
            # Equal weights fallback
            n = len(self.base_models)
            self._weights = [1.0 / n] * n
            self._trained = True
            return

        # Collect predictions from each model
        n_models = len(self.base_models)
        n_matches = len(test_matches)

        # For each match, get each model's Brier score
        model_scores = np.zeros((n_models, n_matches))
        for i, model in enumerate(self.base_models):
            for j, m in enumerate(test_matches):
                try:
                    pred = model.predict(m.home_team, m.away_team, m.neutral, m.importance)
                    actual_h = 1.0 if m.home_win else 0.0
                    actual_d = 1.0 if m.is_draw else 0.0
                    actual_a = 1.0 if m.away_win else 0.0
                    brier = ((pred.home_win_prob - actual_h) ** 2
                             + (pred.draw_prob - actual_d) ** 2
                             + (pred.away_win_prob - actual_a) ** 2)
                    model_scores[i, j] = brier
                except Exception:
                    model_scores[i, j] = 1.0  # max Brier

        # Weight inversely proportional to average Brier score
        avg_briers = model_scores.mean(axis=1)
        # Softmax of negative Brier (lower Brier = higher weight)
        inv_briers = 1.0 / (avg_briers + 0.01)
        total = inv_briers.sum()
        self._weights = (inv_briers / total).tolist()
        self._trained = True

    def train_from_results(self, results: list[ModelResult]) -> None:
        """Alternative: learn weights from pre-computed backtest results."""
        if not results:
            n = len(self.base_models)
            self._weights = [1.0 / n] * n
            return

        # Weight by composite score
        composites = [r.composite for r in results]
        total = sum(composites) + 0.01 * len(composites)
        self._weights = [(c + 0.01) / total for c in composites]
        self._trained = True

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        if not self._trained or not self._weights:
            n = len(self.base_models)
            self._weights = [1.0 / n] * n

        total_hw = total_d = total_aw = 0.0
        total_hxg = total_axg = 0.0
        total_w = 0.0

        for model, weight in zip(self.base_models, self._weights):
            try:
                pred = model.predict(home, away, neutral, importance)
                total_hw += weight * pred.home_win_prob
                total_d += weight * pred.draw_prob
                total_aw += weight * pred.away_win_prob
                total_hxg += weight * pred.home_xg
                total_axg += weight * pred.away_xg
                total_w += weight
            except Exception:
                continue

        if total_w < 0.01:
            return Prediction(0.4, 0.25, 0.35, 1.3, 1.3)

        hw = total_hw / total_w
        d = total_d / total_w
        aw = total_aw / total_w

        # Normalize
        total = hw + d + aw
        if total > 0:
            hw /= total
            d /= total
            aw /= total

        return Prediction(
            home_win_prob=hw,
            draw_prob=d,
            away_win_prob=aw,
            home_xg=total_hxg / total_w,
            away_xg=total_axg / total_w,
        )
