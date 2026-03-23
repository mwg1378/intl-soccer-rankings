"""Model 3: Goal-Weighted Elo — Linear goal diff multiplier."""

from backtest.models.elo.elo_base import EloBase


class GoalWeightedElo(EloBase):
    name = "Goal-Weighted Elo"

    def _goal_diff_multiplier(self, goal_diff: int) -> float:
        """Linear multiplier: 1.0 + 0.1 * |goal_diff|, capped at 1.5."""
        return min(1.0 + 0.1 * abs(goal_diff), 1.5)
