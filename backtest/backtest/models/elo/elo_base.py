"""Shared Elo base class with sequential update infrastructure.

Ported from lib/ranking-engine.ts. All 5 Elo variants extend this.
"""

import math
from typing import Optional

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_ratings

# K-values aligned with FIFA
K_VALUES: dict[str, float] = {
    "FRIENDLY": 10,
    "NATIONS_LEAGUE": 15,
    "QUALIFIER": 25,
    "TOURNAMENT_GROUP": 35,
    "TOURNAMENT_KNOCKOUT": 40,
}

MEAN_REVERSION_RATE = 0.08
MEAN_RATING = 1500.0


def expected_result(team_rating: float, opponent_rating: float) -> float:
    """FIFA Elo expected result with 600-point scaling."""
    return 1.0 / (1.0 + 10.0 ** ((opponent_rating - team_rating) / 600.0))


def match_w(home_score: int, away_score: int,
            home_pen: Optional[int], away_pen: Optional[int]) -> tuple[float, float]:
    """Match result W values. PSO: winner 0.75, loser 0.5."""
    if home_score > away_score:
        return (1.0, 0.0)
    if home_score < away_score:
        return (0.0, 1.0)
    if home_pen is not None and away_pen is not None:
        if home_pen > away_pen:
            return (0.75, 0.5)
        if away_pen > home_pen:
            return (0.5, 0.75)
    return (0.5, 0.5)


class EloBase(BaseModel):
    """Base class for all Elo-variant models."""

    def __init__(self) -> None:
        self.ratings: dict[str, float] = {}  # team → overall rating
        self._off: dict[str, float] = {}     # offensive sub-rating
        self._def: dict[str, float] = {}     # defensive sub-rating
        self._last_year: str = ""

    def reset(self) -> None:
        self.ratings.clear()
        self._off.clear()
        self._def.clear()
        self._last_year = ""

    def _ensure_team(self, team: str) -> None:
        if team not in self.ratings:
            self.ratings[team] = MEAN_RATING
            self._off[team] = MEAN_RATING
            self._def[team] = MEAN_RATING

    def _apply_mean_reversion(self, rate: float = MEAN_REVERSION_RATE) -> None:
        for team in self.ratings:
            self._off[team] += (MEAN_RATING - self._off[team]) * rate
            self._def[team] += (MEAN_RATING - self._def[team]) * rate
            self.ratings[team] = (self._off[team] + (3000 - self._def[team])) / 2

    def _get_k(self, importance: str) -> float:
        return K_VALUES.get(importance, 10.0)

    def _goal_diff_multiplier(self, goal_diff: int) -> float:
        """Override in subclasses for different goal-diff treatments."""
        return 1.0

    def _time_weight(self, match: MatchRecord, ref_date=None) -> float:
        """Override in subclasses for time-decay variants."""
        return 1.0

    def _update_single(self, match: MatchRecord) -> None:
        """Process a single match and update ratings. Override for custom logic."""
        self._ensure_team(match.home_team)
        self._ensure_team(match.away_team)

        # Year boundary mean reversion
        match_year = str(match.date.year)
        if match_year != self._last_year and self._last_year:
            self._apply_mean_reversion()
        self._last_year = match_year

        home_overall = (self._off[match.home_team] + (3000 - self._def[match.home_team])) / 2
        away_overall = (self._off[match.away_team] + (3000 - self._def[match.away_team])) / 2

        we_home = expected_result(home_overall, away_overall)
        we_away = 1.0 - we_home

        w_home, w_away = match_w(
            match.home_score, match.away_score,
            match.home_penalties, match.away_penalties,
        )

        k = self._get_k(match.importance)
        g = self._goal_diff_multiplier(match.goal_diff)
        tw = self._time_weight(match)

        home_delta = k * g * tw * (w_home - we_home)
        away_delta = k * g * tw * (w_away - we_away)

        # Knockout loss protection
        if match.importance == "TOURNAMENT_KNOCKOUT":
            home_delta = max(0, home_delta)
            away_delta = max(0, away_delta)

        # 50/50 off/def split
        self._off[match.home_team] += home_delta * 0.5
        self._def[match.home_team] -= home_delta * 0.5
        self._off[match.away_team] += away_delta * 0.5
        self._def[match.away_team] -= away_delta * 0.5

        self.ratings[match.home_team] = (
            self._off[match.home_team] + (3000 - self._def[match.home_team])
        ) / 2
        self.ratings[match.away_team] = (
            self._off[match.away_team] + (3000 - self._def[match.away_team])
        ) / 2

    def train(self, matches: list[MatchRecord]) -> None:
        for m in matches:
            self._update_single(m)

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        self._ensure_team(home)
        self._ensure_team(away)

        vals = list(self.ratings.values())
        if not vals:
            vals = [1500.0]
        avg_r = sum(vals) / len(vals)
        off_vals = list(self._off.values())
        def_vals = list(self._def.values())

        avg_off = sum(off_vals) / len(off_vals) if off_vals else 1500.0
        avg_def = sum(def_vals) / len(def_vals) if def_vals else 1500.0
        std_off = max((sum((v - avg_off) ** 2 for v in off_vals) / len(off_vals)) ** 0.5, 50.0) if off_vals else 150.0
        std_def = max((sum((v - avg_def) ** 2 for v in def_vals) / len(def_vals)) ** 0.5, 50.0) if def_vals else 150.0

        return predict_from_ratings(
            home_off=self._off[home],
            home_def=self._def[home],
            away_off=self._off[away],
            away_def=self._def[away],
            avg_off=avg_off,
            std_off=std_off,
            avg_def=avg_def,
            std_def=std_def,
            neutral=neutral,
            importance=importance,
        )
