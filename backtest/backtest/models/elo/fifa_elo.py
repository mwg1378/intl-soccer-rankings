"""Model 2: FIFA SUM Elo — Official FIFA methodology (variable K, 600 scaling)."""

from backtest.models.elo.elo_base import EloBase, K_VALUES


class FifaElo(EloBase):
    name = "FIFA SUM Elo"

    def _get_k(self, importance: str) -> float:
        return K_VALUES.get(importance, 10.0)

    def _goal_diff_multiplier(self, goal_diff: int) -> float:
        return 1.0
