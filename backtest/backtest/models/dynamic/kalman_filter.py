"""Model 17: Kalman Filter — State-space model, team strength as latent variable.

Each team's strength is modeled as a latent state that evolves over time.
Match results provide noisy observations of the difference between team strengths.
"""

import math
from collections import defaultdict

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_single_rating

# Kalman filter parameters
PROCESS_NOISE = 5.0      # variance added per match period (team strength drift)
OBSERVATION_NOISE = 200.0  # variance of match outcome noise
INITIAL_VARIANCE = 400.0  # initial uncertainty


class KalmanFilter(BaseModel):
    name = "Kalman Filter"

    def __init__(self) -> None:
        self.mu: dict[str, float] = {}       # state estimate (team strength)
        self.var: dict[str, float] = {}      # state variance (uncertainty)

    def reset(self) -> None:
        self.mu.clear()
        self.var.clear()

    def _ensure_team(self, team: str) -> None:
        if team not in self.mu:
            self.mu[team] = 1500.0
            self.var[team] = INITIAL_VARIANCE

    def train(self, matches: list[MatchRecord]) -> None:
        for m in matches:
            self._ensure_team(m.home_team)
            self._ensure_team(m.away_team)

            # Predict step: add process noise
            self.var[m.home_team] += PROCESS_NOISE
            self.var[m.away_team] += PROCESS_NOISE

            # Observation: goal difference (scaled to rating units)
            observed_diff = (m.home_score - m.away_score) * 100.0  # 1 goal ≈ 100 rating points
            predicted_diff = self.mu[m.home_team] - self.mu[m.away_team]

            # Innovation
            innovation = observed_diff - predicted_diff

            # Innovation variance = var_home + var_away + observation_noise
            S = self.var[m.home_team] + self.var[m.away_team] + OBSERVATION_NOISE

            # Kalman gains
            K_home = self.var[m.home_team] / S
            K_away = self.var[m.away_team] / S

            # Update step
            self.mu[m.home_team] += K_home * innovation
            self.mu[m.away_team] -= K_away * innovation

            self.var[m.home_team] *= (1 - K_home)
            self.var[m.away_team] *= (1 - K_away)

            # Clamp variance
            self.var[m.home_team] = max(self.var[m.home_team], 10.0)
            self.var[m.away_team] = max(self.var[m.away_team], 10.0)

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        self._ensure_team(home)
        self._ensure_team(away)
        return predict_from_single_rating(
            self.mu[home], self.mu[away],
            self.mu, neutral, importance,
        )
