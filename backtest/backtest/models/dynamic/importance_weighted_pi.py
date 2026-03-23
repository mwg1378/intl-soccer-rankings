"""Model 16: Importance-Weighted Pi — Pi-ratings scaled by match importance.

Extends the Constantinou & Fenton Pi-ratings by weighting updates
based on match importance (World Cup > qualifier > friendly).
"""

import math

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_ratings, BASELINE_GOALS, DEFAULT_BASELINE

IMPORTANCE_WEIGHT: dict[str, float] = {
    "FRIENDLY": 0.5,
    "NATIONS_LEAGUE": 0.75,
    "QUALIFIER": 1.0,
    "TOURNAMENT_GROUP": 1.25,
    "TOURNAMENT_KNOCKOUT": 1.5,
}

# Pi-rating parameters
C = 3.0
MU1 = 0.1
MU2 = 0.3
MEAN_REVERSION_RATE = 0.08


def _rating_to_expected_goals(rating: float, c: float) -> float:
    if rating >= 0:
        return 10.0 ** (abs(rating) / c) - 1
    return -(10.0 ** (abs(rating) / c) - 1)


class ImportanceWeightedPi(BaseModel):
    name = "Importance-Weighted Pi"

    def __init__(self) -> None:
        self.home_rating: dict[str, float] = {}
        self.away_rating: dict[str, float] = {}
        self._last_year: str = ""

    def reset(self) -> None:
        self.home_rating.clear()
        self.away_rating.clear()
        self._last_year = ""

    def _ensure_team(self, team: str) -> None:
        if team not in self.home_rating:
            self.home_rating[team] = 0.0
            self.away_rating[team] = 0.0

    def train(self, matches: list[MatchRecord]) -> None:
        for m in matches:
            self._ensure_team(m.home_team)
            self._ensure_team(m.away_team)

            # Year boundary mean reversion
            year = str(m.date.year)
            if year != self._last_year and self._last_year:
                for t in self.home_rating:
                    self.home_rating[t] *= (1 - MEAN_REVERSION_RATE)
                    self.away_rating[t] *= (1 - MEAN_REVERSION_RATE)
            self._last_year = year

            importance_w = IMPORTANCE_WEIGHT.get(m.importance, 1.0)
            observed_gd = m.home_score - m.away_score

            if m.neutral:
                home_avg = (self.home_rating[m.home_team] + self.away_rating[m.home_team]) / 2
                away_avg = (self.home_rating[m.away_team] + self.away_rating[m.away_team]) / 2
                egd_h = _rating_to_expected_goals(home_avg, C)
                egd_a = _rating_to_expected_goals(away_avg, C)
                expected_gd = egd_h - egd_a
                error = abs(observed_gd - expected_gd)
                we = C * math.log10(1 + error)
                if expected_gd >= observed_gd:
                    we = -we

                scaled_mu = MU1 * importance_w * 0.5
                self.home_rating[m.home_team] += we * scaled_mu
                self.away_rating[m.home_team] += we * scaled_mu
                self.home_rating[m.away_team] -= we * scaled_mu
                self.away_rating[m.away_team] -= we * scaled_mu
            else:
                hr = self.home_rating[m.home_team]
                ar = self.away_rating[m.away_team]
                egd_h = _rating_to_expected_goals(hr, C)
                egd_a = _rating_to_expected_goals(ar, C)
                expected_gd = egd_h - egd_a

                error = abs(observed_gd - expected_gd)
                we = C * math.log10(1 + error)
                if expected_gd >= observed_gd:
                    we = -we

                scaled_mu1 = MU1 * importance_w
                new_home_home = hr + we * scaled_mu1
                new_away_away = ar - we * scaled_mu1

                self.home_rating[m.home_team] = new_home_home
                self.away_rating[m.away_team] = new_away_away
                self.away_rating[m.home_team] += (new_home_home - hr) * MU2
                self.home_rating[m.away_team] += (new_away_away - ar) * MU2

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        self._ensure_team(home)
        self._ensure_team(away)

        # Convert pi-ratings to Elo-scale for the shared prediction layer
        h_overall = (self.home_rating[home] + self.away_rating[home]) / 2
        a_overall = (self.home_rating[away] + self.away_rating[away]) / 2

        # Map to 1500-centered scale: pi-rating 0 = 1500, each unit ≈ 100 Elo
        h_elo = 1500.0 + h_overall * 100.0
        a_elo = 1500.0 + a_overall * 100.0

        all_r = {}
        for t in self.home_rating:
            overall = (self.home_rating[t] + self.away_rating[t]) / 2
            all_r[t] = 1500.0 + overall * 100.0

        return predict_from_ratings(
            home_off=h_elo, home_def=3000 - h_elo,
            away_off=a_elo, away_def=3000 - a_elo,
            avg_off=sum(all_r.values()) / len(all_r) if all_r else 1500.0,
            std_off=max((sum((v - sum(all_r.values()) / len(all_r)) ** 2 for v in all_r.values()) / len(all_r)) ** 0.5, 50.0) if len(all_r) > 1 else 150.0,
            avg_def=3000 - (sum(all_r.values()) / len(all_r) if all_r else 1500.0),
            std_def=max((sum((v - sum(all_r.values()) / len(all_r)) ** 2 for v in all_r.values()) / len(all_r)) ** 0.5, 50.0) if len(all_r) > 1 else 150.0,
            neutral=neutral,
            importance=importance,
        )
