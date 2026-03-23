"""Model 19: Market Value Model — EA FC player ratings as primary predictor.

Uses summed EA FC player ratings as a proxy for squad market value,
then converts to match predictions via the shared Poisson layer.
"""

import csv
from collections import defaultdict
from pathlib import Path

from backtest.data.loader import MatchRecord, DATA_DIR
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_single_rating

NATIONALITY_MAP: dict[str, str] = {
    "England": "England", "France": "France", "Germany": "Germany",
    "Spain": "Spain", "Italy": "Italy", "Netherlands": "Netherlands",
    "Portugal": "Portugal", "Brazil": "Brazil", "Argentina": "Argentina",
    "Belgium": "Belgium", "Croatia": "Croatia", "Denmark": "Denmark",
    "Uruguay": "Uruguay", "Colombia": "Colombia", "Mexico": "Mexico",
    "United States": "United States", "Japan": "Japan",
    "Korea Republic": "Korea Republic", "Australia": "Australia",
    "Switzerland": "Switzerland", "Austria": "Austria", "Poland": "Poland",
    "Sweden": "Sweden", "Norway": "Norway", "Turkey": "Turkey",
    "Ukraine": "Ukraine", "Serbia": "Serbia", "Chile": "Chile",
    "Peru": "Peru", "Ecuador": "Ecuador", "Paraguay": "Paraguay",
    "Venezuela": "Venezuela", "Nigeria": "Nigeria", "Cameroon": "Cameroon",
    "Ghana": "Ghana", "Senegal": "Senegal", "Egypt": "Egypt",
    "Morocco": "Morocco", "Algeria": "Algeria", "Tunisia": "Tunisia",
    "South Africa": "South Africa", "Iran": "Iran",
    "Saudi Arabia": "Saudi Arabia", "Qatar": "Qatar", "Canada": "Canada",
    "Costa Rica": "Costa Rica", "Panama": "Panama", "Honduras": "Honduras",
    "Jamaica": "Jamaica", "Scotland": "Scotland", "Wales": "Wales",
    "Finland": "Finland", "Iceland": "Iceland", "Greece": "Greece",
    "Czech Republic": "Czech Republic", "Romania": "Romania",
    "Hungary": "Hungary", "Russia": "Russia", "Bolivia": "Bolivia",
    "Iraq": "Iraq", "China PR": "China PR", "India": "India",
    "Ivory Coast": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast",
}


class MarketValueModel(BaseModel):
    name = "Market Value"
    requires_ea_ratings = True

    def __init__(self) -> None:
        self.squad_rating: dict[str, float] = {}

    def reset(self) -> None:
        self.squad_rating.clear()

    def train(self, matches: list[MatchRecord]) -> None:
        ea_path = DATA_DIR / "fifa-ratings" / "male_players.csv"
        if not ea_path.exists():
            # Fallback: assign uniform ratings
            teams = set()
            for m in matches:
                teams.add(m.home_team)
                teams.add(m.away_team)
            for t in teams:
                self.squad_rating[t] = 1500.0
            return

        team_ratings: dict[str, list[int]] = defaultdict(list)
        with open(ea_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                nat = row.get("nationality_name", "")
                team = NATIONALITY_MAP.get(nat)
                if team:
                    try:
                        overall = int(row.get("overall", "0"))
                        if overall > 0:
                            team_ratings[team].append(overall)
                    except ValueError:
                        pass

        # Top 23 players, weighted sum (starters weighted more)
        raw: dict[str, float] = {}
        for team, ratings in team_ratings.items():
            top = sorted(ratings, reverse=True)[:23]
            # Weight: first 11 players count 2x
            value = sum(r * (2.0 if i < 11 else 1.0) for i, r in enumerate(top))
            raw[team] = value

        if raw:
            vals = list(raw.values())
            mean_v = sum(vals) / len(vals)
            std_v = max((sum((v - mean_v) ** 2 for v in vals) / len(vals)) ** 0.5, 1.0)
            for team, v in raw.items():
                self.squad_rating[team] = 1500.0 + (v - mean_v) / std_v * 150.0

        # Ensure all teams from matches have ratings
        for m in matches:
            if m.home_team not in self.squad_rating:
                self.squad_rating[m.home_team] = 1350.0
            if m.away_team not in self.squad_rating:
                self.squad_rating[m.away_team] = 1350.0

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        hr = self.squad_rating.get(home, 1350.0)
        ar = self.squad_rating.get(away, 1350.0)
        return predict_from_single_rating(hr, ar, self.squad_rating, neutral, importance)
