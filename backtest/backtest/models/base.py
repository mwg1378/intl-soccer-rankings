"""Base model ABC for all prediction models."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from backtest.data.loader import MatchRecord


@dataclass
class Prediction:
    home_win_prob: float
    draw_prob: float
    away_win_prob: float
    home_xg: float
    away_xg: float

    def outcome_probs(self) -> tuple[float, float, float]:
        return (self.home_win_prob, self.draw_prob, self.away_win_prob)

    @property
    def predicted_outcome(self) -> str:
        mx = max(self.home_win_prob, self.draw_prob, self.away_win_prob)
        if mx == self.home_win_prob:
            return "H"
        if mx == self.away_win_prob:
            return "A"
        return "D"


class BaseModel(ABC):
    name: str = "BaseModel"
    requires_market_value: bool = False
    requires_ea_ratings: bool = False

    @abstractmethod
    def train(self, matches: list[MatchRecord]) -> None:
        """Process historical matches up to tournament cutoff."""

    @abstractmethod
    def predict(
        self,
        home: str,
        away: str,
        neutral: bool,
        importance: str,
    ) -> Prediction:
        """Return prediction with all 5 outputs."""

    @abstractmethod
    def reset(self) -> None:
        """Reset state for fresh training run."""

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}: {self.name}>"
