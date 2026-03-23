"""Model 5: Recency-Weighted Elo — Exponential time decay (2-year half-life)."""

import math
from datetime import date

from backtest.data.loader import MatchRecord
from backtest.models.elo.elo_base import EloBase

HALF_LIFE_DAYS = 730  # 2 years


class RecencyWeightedElo(EloBase):
    name = "Recency-Weighted Elo"

    def __init__(self) -> None:
        super().__init__()
        self._ref_date: date | None = None

    def reset(self) -> None:
        super().reset()
        self._ref_date = None

    def train(self, matches: list[MatchRecord]) -> None:
        if matches:
            self._ref_date = matches[-1].date
        super().train(matches)

    def _time_weight(self, match: MatchRecord, ref_date=None) -> float:
        if self._ref_date is None:
            return 1.0
        days_diff = (self._ref_date - match.date).days
        if days_diff <= 0:
            return 1.0
        return 0.5 ** (days_diff / HALF_LIFE_DAYS)

    def _goal_diff_multiplier(self, goal_diff: int) -> float:
        """Moderate log-based multiplier."""
        absd = abs(goal_diff)
        if absd <= 1:
            return 1.0
        return min(1.0 + math.log(absd) * 0.12, 1.25)
