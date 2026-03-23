"""Model 1: Vanilla Elo — Fixed K=20, no goal diff, no HA tuning."""

from backtest.models.elo.elo_base import EloBase


class VanillaElo(EloBase):
    name = "Vanilla Elo"

    def _get_k(self, importance: str) -> float:
        return 20.0

    def _goal_diff_multiplier(self, goal_diff: int) -> float:
        return 1.0
