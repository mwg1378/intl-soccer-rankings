"""Model 20: Squad Depth Model — EA FC ratings using full squad (not just best XI).

Considers squad depth by incorporating players beyond the starting 11,
giving weight to the 12th-30th best players as a depth metric.
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
    "Peru": "Peru", "Ecuador": "Ecuador", "Nigeria": "Nigeria",
    "Cameroon": "Cameroon", "Ghana": "Ghana", "Senegal": "Senegal",
    "Egypt": "Egypt", "Morocco": "Morocco", "Algeria": "Algeria",
    "Iran": "Iran", "Saudi Arabia": "Saudi Arabia", "Qatar": "Qatar",
    "Canada": "Canada", "Costa Rica": "Costa Rica",
    "Scotland": "Scotland", "Wales": "Wales",
    "Russia": "Russia", "Paraguay": "Paraguay", "Venezuela": "Venezuela",
    "Tunisia": "Tunisia", "South Africa": "South Africa",
    "Ivory Coast": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast",
}


class SquadDepthModel(BaseModel):
    name = "Squad Depth"
    requires_ea_ratings = True

    def __init__(self) -> None:
        self.team_rating: dict[str, float] = {}

    def reset(self) -> None:
        self.team_rating.clear()

    def train(self, matches: list[MatchRecord]) -> None:
        ea_path = DATA_DIR / "fifa-ratings" / "male_players.csv"
        if not ea_path.exists():
            for m in matches:
                self.team_rating.setdefault(m.home_team, 1500.0)
                self.team_rating.setdefault(m.away_team, 1500.0)
            return

        team_players: dict[str, list[int]] = defaultdict(list)
        with open(ea_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                nat = row.get("nationality_name", "")
                team = NATIONALITY_MAP.get(nat)
                if team:
                    try:
                        overall = int(row.get("overall", "0"))
                        if overall > 0:
                            team_players[team].append(overall)
                    except ValueError:
                        pass

        raw: dict[str, float] = {}
        for team, ratings in team_players.items():
            top = sorted(ratings, reverse=True)[:30]
            # Best XI quality (60%) + depth quality (40%)
            best_xi = top[:11]
            depth = top[11:30]
            xi_avg = sum(best_xi) / len(best_xi) if best_xi else 50
            depth_avg = sum(depth) / len(depth) if depth else 50
            raw[team] = 0.6 * xi_avg + 0.4 * depth_avg

        if raw:
            vals = list(raw.values())
            mean_v = sum(vals) / len(vals)
            std_v = max((sum((v - mean_v) ** 2 for v in vals) / len(vals)) ** 0.5, 1.0)
            for team, v in raw.items():
                self.team_rating[team] = 1500.0 + (v - mean_v) / std_v * 150.0

        for m in matches:
            self.team_rating.setdefault(m.home_team, 1350.0)
            self.team_rating.setdefault(m.away_team, 1350.0)

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        hr = self.team_rating.get(home, 1350.0)
        ar = self.team_rating.get(away, 1350.0)
        return predict_from_single_rating(hr, ar, self.team_rating, neutral, importance)
