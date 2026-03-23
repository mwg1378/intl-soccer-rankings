"""Shared ML base class for feature-based machine learning models.

Handles feature matrix construction and label encoding. All ML models
(22-25) extend this base.
"""

import math
from datetime import date

import numpy as np

from backtest.data.loader import MatchRecord
from backtest.data.features import build_matchup_features
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import BASELINE_GOALS, DEFAULT_BASELINE


class MLBase(BaseModel):
    """Base class for machine learning models."""

    def __init__(self) -> None:
        self._matches: list[MatchRecord] = []
        self._model = None  # sklearn-compatible model
        self._cutoff: date = date(2020, 1, 1)

    def reset(self) -> None:
        self._matches.clear()
        self._model = None

    def _build_dataset(
        self, matches: list[MatchRecord], all_matches: list[MatchRecord],
    ) -> tuple[np.ndarray, np.ndarray]:
        """Build feature matrix X and label vector y from matches."""
        X_list = []
        y_list = []

        for m in matches:
            features = build_matchup_features(
                m.home_team, m.away_team, all_matches, m.date,
            )
            X_list.append(features)
            # Labels: 0=home win, 1=draw, 2=away win
            if m.home_win:
                y_list.append(0)
            elif m.is_draw:
                y_list.append(1)
            else:
                y_list.append(2)

        return np.array(X_list, dtype=np.float64), np.array(y_list, dtype=np.int32)

    def _create_model(self):
        """Override in subclasses to create the specific ML model."""
        raise NotImplementedError

    def train(self, matches: list[MatchRecord]) -> None:
        self._matches = list(matches)
        if len(matches) < 100:
            return

        self._cutoff = matches[-1].date

        # Use last 3000 matches for training
        train_matches = matches[-3000:]
        X, y = self._build_dataset(train_matches, matches)

        if len(X) < 50 or len(np.unique(y)) < 2:
            return

        self._model = self._create_model()
        self._model.fit(X, y)

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        if self._model is None:
            return Prediction(0.4, 0.25, 0.35, 1.3, 1.3)

        features = build_matchup_features(home, away, self._matches, self._cutoff)
        X = np.array([features], dtype=np.float64)

        if hasattr(self._model, 'predict_proba'):
            probs = self._model.predict_proba(X)[0]
            # Map to H/D/A (classes 0, 1, 2)
            classes = list(self._model.classes_)
            home_win = probs[classes.index(0)] if 0 in classes else 0.33
            draw = probs[classes.index(1)] if 1 in classes else 0.33
            away_win = probs[classes.index(2)] if 2 in classes else 0.33
        else:
            home_win, draw, away_win = 0.4, 0.25, 0.35

        # Normalize
        total = home_win + draw + away_win
        if total > 0:
            home_win /= total
            draw /= total
            away_win /= total

        # Expected goals
        baseline = BASELINE_GOALS.get(importance, DEFAULT_BASELINE)
        strength_diff = (home_win - away_win) * 2.0
        home_xg = max(0.15, min(baseline + strength_diff * 0.5, 6.0))
        away_xg = max(0.15, min(baseline - strength_diff * 0.5, 6.0))

        return Prediction(home_win, draw, away_win, home_xg, away_xg)
