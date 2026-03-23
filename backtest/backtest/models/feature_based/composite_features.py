"""Model 21: Composite Features — ~20 engineered features + logistic regression."""

import math
from datetime import date

from backtest.data.loader import MatchRecord
from backtest.data.features import build_matchup_features
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import BASELINE_GOALS, DEFAULT_BASELINE


class CompositeFeatures(BaseModel):
    name = "Composite Features"

    def __init__(self) -> None:
        self._matches: list[MatchRecord] = []
        self._weights: list[float] = []  # logistic regression weights
        self._bias: float = 0.0
        self._cutoff: date = date(2020, 1, 1)

    def reset(self) -> None:
        self._matches.clear()
        self._weights.clear()
        self._bias = 0.0

    def train(self, matches: list[MatchRecord]) -> None:
        self._matches = list(matches)
        if not matches:
            return

        self._cutoff = matches[-1].date

        # Use last 2000 matches for training logistic regression
        train_subset = matches[-2000:]

        # Build training data
        X = []
        y_home = []  # 1 = home win, 0 = not
        y_draw = []

        for m in train_subset:
            features = build_matchup_features(m.home_team, m.away_team, matches, m.date)
            X.append(features)
            y_home.append(1.0 if m.home_win else 0.0)
            y_draw.append(1.0 if m.is_draw else 0.0)

        if not X:
            return

        n_features = len(X[0])

        # Simple gradient descent for logistic regression (home win probability)
        self._weights = [0.0] * n_features
        self._bias = 0.0
        lr = 0.01

        for epoch in range(50):
            for i in range(len(X)):
                # Linear combination
                z = self._bias + sum(w * x for w, x in zip(self._weights, X[i]))
                pred = 1.0 / (1.0 + math.exp(-max(-10, min(10, z))))

                # Gradient
                error = y_home[i] - pred
                self._bias += lr * error
                for j in range(n_features):
                    self._weights[j] += lr * error * X[i][j]

            # Decay learning rate
            lr *= 0.95

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        if not self._weights:
            return Prediction(0.4, 0.25, 0.35, 1.3, 1.3)

        features = build_matchup_features(home, away, self._matches, self._cutoff)

        # Home win probability from logistic regression
        z = self._bias + sum(w * x for w, x in zip(self._weights, features))
        home_win_raw = 1.0 / (1.0 + math.exp(-max(-10, min(10, z))))

        # Calibrate draw and away probabilities
        # Empirical: draw ≈ 25%, scale home/away around that
        draw_prob = 0.25
        remaining = 1.0 - draw_prob
        home_win = home_win_raw * remaining
        away_win = (1.0 - home_win_raw) * remaining

        # Normalize
        total = home_win + draw_prob + away_win
        home_win /= total
        draw_prob /= total
        away_win /= total

        # Expected goals from feature-based estimates
        baseline = BASELINE_GOALS.get(importance, DEFAULT_BASELINE)
        gd_est = features[5] - features[14] if len(features) > 14 else 0  # avg_gd differential
        home_xg = max(0.15, baseline + gd_est * 0.3)
        away_xg = max(0.15, baseline - gd_est * 0.3)

        return Prediction(home_win, draw_prob, away_win, home_xg, away_xg)
