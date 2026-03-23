"""Model 14: Whole History Rating — Time-varying Bradley-Terry, full-history optimization.

Simplified WHR: divides history into yearly segments, each team has
a rating per year, with a Wiener process prior connecting consecutive years.
"""

import math
from collections import defaultdict
from datetime import date

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_single_rating

W2 = 50.0  # Wiener process variance per year (controls smoothness)


class WholeHistoryRating(BaseModel):
    name = "Whole History Rating"

    def __init__(self) -> None:
        # ratings[team][year] = rating
        self.ratings: dict[str, dict[int, float]] = {}
        self._all_flat: dict[str, float] = {}  # current best rating per team

    def reset(self) -> None:
        self.ratings.clear()
        self._all_flat.clear()

    def _ensure_team(self, team: str, year: int) -> None:
        if team not in self.ratings:
            self.ratings[team] = {}
        if year not in self.ratings[team]:
            # Initialize from nearest known year or 0
            known = self.ratings[team]
            if known:
                nearest = min(known.keys(), key=lambda y: abs(y - year))
                self.ratings[team][year] = known[nearest]
            else:
                self.ratings[team][year] = 0.0

    def train(self, matches: list[MatchRecord]) -> None:
        if not matches:
            return

        # Organize matches by year
        year_matches: dict[int, list[MatchRecord]] = defaultdict(list)
        for m in matches:
            year_matches[m.date.year].append(m)
            self._ensure_team(m.home_team, m.date.year)
            self._ensure_team(m.away_team, m.date.year)

        years = sorted(year_matches.keys())

        # Iterative optimization (simplified Newton-Raphson on each rating)
        for iteration in range(15):
            for year in years:
                for m in year_matches[year]:
                    home_r = self.ratings[m.home_team].get(year, 0.0)
                    away_r = self.ratings[m.away_team].get(year, 0.0)

                    # Expected result
                    diff = (home_r - away_r) / 600.0 * math.log(10)
                    e_home = 1.0 / (1.0 + math.exp(-diff))

                    # Actual result
                    if m.home_score > m.away_score:
                        w = 1.0
                    elif m.home_score < m.away_score:
                        w = 0.0
                    else:
                        w = 0.5

                    # Gradient
                    scale = math.log(10) / 600.0
                    grad = scale * (w - e_home)
                    hess = -scale * scale * e_home * (1.0 - e_home)

                    if abs(hess) > 1e-10:
                        step = min(max(-15.0, -grad / hess), 15.0)
                        self.ratings[m.home_team][year] = home_r + step * 0.3
                        self.ratings[m.away_team][year] = away_r - step * 0.3

            # Apply Wiener process prior (smoothing between years)
            for team in self.ratings:
                team_years = sorted(self.ratings[team].keys())
                for i in range(len(team_years) - 1):
                    y1, y2 = team_years[i], team_years[i + 1]
                    r1, r2 = self.ratings[team][y1], self.ratings[team][y2]
                    gap = y2 - y1
                    # Pull toward each other proportional to prior
                    prior_precision = 1.0 / (W2 * gap)
                    pull = (r2 - r1) * prior_precision * 0.1
                    self.ratings[team][y1] = r1 + pull
                    self.ratings[team][y2] = r2 - pull

        # Set current ratings (latest year for each team) on 1500-centered scale
        for team in self.ratings:
            latest_year = max(self.ratings[team].keys())
            self._all_flat[team] = self.ratings[team][latest_year] + 1500.0

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        hr = self._all_flat.get(home, 1500.0)
        ar = self._all_flat.get(away, 1500.0)
        return predict_from_single_rating(hr, ar, self._all_flat, neutral, importance)
