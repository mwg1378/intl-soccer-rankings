"""Model 15: Berrar Rating — k-NN informed adjustments (2017 Challenge approach).

Uses a team's recent performance against similar-strength opponents
to adjust predictions. Combines a base Elo rating with k-NN matching
on opponent strength for prediction refinement.
"""

import math
from collections import defaultdict
from typing import Optional

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_single_rating

K_NN = 10  # number of nearest neighbors


class BerrarRating(BaseModel):
    name = "Berrar k-NN"

    def __init__(self) -> None:
        self.ratings: dict[str, float] = {}
        # Store recent match history per team for k-NN lookup
        self._history: dict[str, list[tuple[float, float, float]]] = {}  # team → [(opp_rating, actual_W, weight)]

    def reset(self) -> None:
        self.ratings.clear()
        self._history.clear()

    def _ensure_team(self, team: str) -> None:
        if team not in self.ratings:
            self.ratings[team] = 1500.0
            self._history[team] = []

    def train(self, matches: list[MatchRecord]) -> None:
        for m in matches:
            self._ensure_team(m.home_team)
            self._ensure_team(m.away_team)

            hr = self.ratings[m.home_team]
            ar = self.ratings[m.away_team]

            # Expected result (600-point scale)
            we = 1.0 / (1.0 + 10.0 ** ((ar - hr) / 600.0))

            # Actual result
            if m.home_score > m.away_score:
                w_h, w_a = 1.0, 0.0
            elif m.home_score < m.away_score:
                w_h, w_a = 0.0, 1.0
            else:
                w_h, w_a = 0.5, 0.5

            # Elo update
            k = 20.0
            self.ratings[m.home_team] += k * (w_h - we)
            self.ratings[m.away_team] += k * (w_a - (1.0 - we))

            # Store in history (keep last 50 matches per team)
            time_weight = 1.0  # could add decay
            self._history[m.home_team].append((ar, w_h, time_weight))
            self._history[m.away_team].append((hr, w_a, time_weight))

            if len(self._history[m.home_team]) > 50:
                self._history[m.home_team] = self._history[m.home_team][-50:]
            if len(self._history[m.away_team]) > 50:
                self._history[m.away_team] = self._history[m.away_team][-50:]

    def _knn_adjustment(self, team: str, opponent_rating: float) -> float:
        """Get k-NN informed adjustment based on performance vs similar opponents."""
        history = self._history.get(team, [])
        if len(history) < 3:
            return 0.0

        # Sort by distance to current opponent rating
        scored = [(abs(h[0] - opponent_rating), h[1], h[2]) for h in history]
        scored.sort(key=lambda x: x[0])

        # Take k nearest
        neighbors = scored[:K_NN]
        if not neighbors:
            return 0.0

        # Weighted average of actual W
        total_w = 0.0
        total_weight = 0.0
        for dist, w, weight in neighbors:
            kernel_weight = 1.0 / (1.0 + dist / 100.0)  # distance kernel
            total_w += w * weight * kernel_weight
            total_weight += weight * kernel_weight

        if total_weight < 0.01:
            return 0.0

        avg_w = total_w / total_weight
        # Adjustment: how much better/worse than expected 0.5
        return (avg_w - 0.5) * 30.0  # scale to Elo points

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        self._ensure_team(home)
        self._ensure_team(away)

        hr = self.ratings[home]
        ar = self.ratings[away]

        # Apply k-NN adjustments
        adj_home = self._knn_adjustment(home, ar)
        adj_away = self._knn_adjustment(away, hr)

        effective_home = hr + adj_home
        effective_away = ar + adj_away

        return predict_from_single_rating(
            effective_home, effective_away,
            self.ratings, neutral, importance,
        )
