"""Model 18: FiveThirtyEight-Style — Elo + squad market value blend.

Combines an Elo rating with squad market value data (from EA FC ratings
as a proxy for market value) to produce a blended rating.
"""

import math
import csv
from collections import defaultdict
from pathlib import Path
from typing import Optional

from backtest.data.loader import MatchRecord, DATA_DIR
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_single_rating
from backtest.models.elo.elo_base import EloBase, expected_result, match_w, K_VALUES, MEAN_RATING

# Nationality-to-team mapping for EA FC data
NATIONALITY_MAP: dict[str, str] = {
    "England": "England", "France": "France", "Germany": "Germany",
    "Spain": "Spain", "Italy": "Italy", "Netherlands": "Netherlands",
    "Portugal": "Portugal", "Brazil": "Brazil", "Argentina": "Argentina",
    "Belgium": "Belgium", "Croatia": "Croatia", "Denmark": "Denmark",
    "Sweden": "Sweden", "Switzerland": "Switzerland", "Austria": "Austria",
    "Poland": "Poland", "Czech Republic": "Czech Republic",
    "Romania": "Romania", "Hungary": "Hungary", "Greece": "Greece",
    "Scotland": "Scotland", "Wales": "Wales", "Norway": "Norway",
    "Finland": "Finland", "Iceland": "Iceland", "Turkey": "Turkey",
    "Ukraine": "Ukraine", "Russia": "Russia", "Serbia": "Serbia",
    "Japan": "Japan", "Korea Republic": "Korea Republic",
    "Australia": "Australia", "Iran": "Iran", "Saudi Arabia": "Saudi Arabia",
    "Qatar": "Qatar", "United States": "United States",
    "Mexico": "Mexico", "Canada": "Canada", "Colombia": "Colombia",
    "Chile": "Chile", "Peru": "Peru", "Ecuador": "Ecuador",
    "Uruguay": "Uruguay", "Paraguay": "Paraguay", "Venezuela": "Venezuela",
    "Nigeria": "Nigeria", "Cameroon": "Cameroon", "Ghana": "Ghana",
    "Senegal": "Senegal", "Egypt": "Egypt", "Morocco": "Morocco",
    "Algeria": "Algeria", "Tunisia": "Tunisia", "South Africa": "South Africa",
    "Ivory Coast": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast",
    "Bolivia": "Bolivia", "Costa Rica": "Costa Rica",
    "China PR": "China PR",
}


class FiveThirtyEightStyle(BaseModel):
    name = "FiveThirtyEight-Style"
    requires_ea_ratings = True

    def __init__(self) -> None:
        self.elo: dict[str, float] = {}
        self.squad_value: dict[str, float] = {}  # team → normalized squad value
        self._last_year: str = ""

    def reset(self) -> None:
        self.elo.clear()
        self.squad_value.clear()
        self._last_year = ""

    def _ensure_team(self, team: str) -> None:
        if team not in self.elo:
            self.elo[team] = MEAN_RATING

    def _load_squad_values(self) -> None:
        """Load squad values from EA FC player ratings as proxy for market value."""
        ea_path = DATA_DIR / "fifa-ratings" / "male_players.csv"
        if not ea_path.exists():
            return

        team_values: dict[str, list[int]] = defaultdict(list)
        try:
            with open(ea_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    nat = row.get("nationality_name", "")
                    team = NATIONALITY_MAP.get(nat)
                    if team:
                        try:
                            overall = int(row.get("overall", "0"))
                            if overall > 0:
                                team_values[team].append(overall)
                        except ValueError:
                            pass
        except Exception:
            return

        # Top 23 players per team, sum as "squad value"
        if team_values:
            raw_values: dict[str, float] = {}
            for team, ratings in team_values.items():
                top23 = sorted(ratings, reverse=True)[:23]
                raw_values[team] = sum(top23)

            # Normalize to 1500-centered Elo scale
            vals = list(raw_values.values())
            if vals:
                mean_v = sum(vals) / len(vals)
                std_v = max((sum((v - mean_v) ** 2 for v in vals) / len(vals)) ** 0.5, 1.0)
                for team, v in raw_values.items():
                    self.squad_value[team] = 1500.0 + (v - mean_v) / std_v * 150.0

    def train(self, matches: list[MatchRecord]) -> None:
        self._load_squad_values()

        for m in matches:
            self._ensure_team(m.home_team)
            self._ensure_team(m.away_team)

            # Year boundary mean reversion
            year = str(m.date.year)
            if year != self._last_year and self._last_year:
                for t in self.elo:
                    self.elo[t] += (MEAN_RATING - self.elo[t]) * 0.08
            self._last_year = year

            hr = self.elo[m.home_team]
            ar = self.elo[m.away_team]

            we = expected_result(hr, ar)
            w_h, w_a = match_w(m.home_score, m.away_score,
                               m.home_penalties, m.away_penalties)

            k = K_VALUES.get(m.importance, 10.0)
            self.elo[m.home_team] += k * (w_h - we)
            self.elo[m.away_team] += k * (w_a - (1.0 - we))

    def _blended_rating(self, team: str) -> float:
        """70% Elo + 30% squad value (FiveThirtyEight-style blend)."""
        elo_r = self.elo.get(team, MEAN_RATING)
        sv = self.squad_value.get(team, MEAN_RATING)
        return 0.7 * elo_r + 0.3 * sv

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        self._ensure_team(home)
        self._ensure_team(away)

        all_r = {t: self._blended_rating(t) for t in self.elo}
        return predict_from_single_rating(
            self._blended_rating(home),
            self._blended_rating(away),
            all_r, neutral, importance,
        )
