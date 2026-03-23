"""Model 4: Margin-Optimized Elo — Heavy goal diff emphasis for margin prediction."""

import math

from backtest.models.elo.elo_base import EloBase


class MarginOptimizedElo(EloBase):
    name = "Margin-Optimized Elo"

    def _goal_diff_multiplier(self, goal_diff: int) -> float:
        """Heavy emphasis: 1 + 0.5 * ln(1 + |gd|), encourages margin sensitivity."""
        absd = abs(goal_diff)
        if absd == 0:
            return 1.0
        return 1.0 + 0.5 * math.log(1 + absd)
