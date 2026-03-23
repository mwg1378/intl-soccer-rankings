"""Shared Poisson base with MLE fitting for attack/defense parameters.

All 6 Poisson-family models (6-11) extend this base which handles:
- Team attack/defense parameter estimation via weighted MLE
- Time decay for recent match emphasis
- Home advantage estimation
"""

import math
from collections import defaultdict
from datetime import date
from typing import Optional

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_lambdas, RHO

HALF_LIFE_DAYS = 730  # 2-year half-life for time decay


class PoissonBase(BaseModel):
    """Base class for Poisson-family score prediction models."""

    def __init__(self, time_decay: bool = True) -> None:
        self.attack: dict[str, float] = {}   # log attack strength
        self.defense: dict[str, float] = {}  # log defense strength
        self.home_advantage: float = 0.0     # log home advantage
        self.avg_goals: float = 1.35
        self._time_decay = time_decay
        self._ref_date: Optional[date] = None
        self._trained_matches: list[MatchRecord] = []

    def reset(self) -> None:
        self.attack.clear()
        self.defense.clear()
        self.home_advantage = 0.0
        self.avg_goals = 1.35
        self._ref_date = None
        self._trained_matches.clear()

    def _time_weight(self, match_date: date) -> float:
        if not self._time_decay or self._ref_date is None:
            return 1.0
        days = (self._ref_date - match_date).days
        if days <= 0:
            return 1.0
        return 0.5 ** (days / HALF_LIFE_DAYS)

    def train(self, matches: list[MatchRecord]) -> None:
        """Fit attack/defense parameters via iterative weighted MLE."""
        self._trained_matches = list(matches)
        if not matches:
            return

        self._ref_date = matches[-1].date

        # Collect all teams
        teams: set[str] = set()
        for m in matches:
            teams.add(m.home_team)
            teams.add(m.away_team)

        # Initialize parameters
        for t in teams:
            self.attack[t] = 0.0
            self.defense[t] = 0.0
        self.home_advantage = math.log(1.22)  # ~0.20
        self.avg_goals = 1.35

        # Iterative MLE (simplified coordinate ascent)
        for iteration in range(20):
            # E-step: compute expected goals for each match
            # M-step: update parameters to maximize weighted log-likelihood

            # Accumulate sufficient statistics
            attack_num = defaultdict(float)
            attack_den = defaultdict(float)
            defense_num = defaultdict(float)
            defense_den = defaultdict(float)
            total_home_goals = 0.0
            total_away_goals = 0.0
            total_home_expected = 0.0
            total_away_expected = 0.0
            total_weight = 0.0

            for m in matches:
                w = self._time_weight(m.date)
                if w < 0.01:
                    continue

                ha = 0.0 if m.neutral else self.home_advantage
                exp_h = max(-10, min(10, self.attack.get(m.home_team, 0.0)
                    - self.defense.get(m.away_team, 0.0) + ha))
                exp_a = max(-10, min(10, self.attack.get(m.away_team, 0.0)
                    - self.defense.get(m.home_team, 0.0)))
                mu_h = self.avg_goals * math.exp(exp_h)
                mu_a = self.avg_goals * math.exp(exp_a)

                mu_h = max(mu_h, 0.1)
                mu_a = max(mu_a, 0.1)

                # Attack updates: goals scored / expected goals scored
                attack_num[m.home_team] += w * m.home_score
                attack_den[m.home_team] += w * mu_h
                attack_num[m.away_team] += w * m.away_score
                attack_den[m.away_team] += w * mu_a

                # Defense updates: goals conceded / expected goals conceded
                defense_num[m.home_team] += w * m.away_score
                defense_den[m.home_team] += w * mu_a
                defense_num[m.away_team] += w * m.home_score
                defense_den[m.away_team] += w * mu_h

                total_home_goals += w * m.home_score
                total_away_goals += w * m.away_score
                total_home_expected += w * mu_h
                total_away_expected += w * mu_a
                total_weight += w

            # Update attack parameters (clamp to prevent overflow)
            for t in teams:
                if attack_den[t] > 0:
                    ratio = attack_num[t] / attack_den[t]
                    if ratio > 0:
                        self.attack[t] += math.log(ratio) * 0.5
                        self.attack[t] = max(-5, min(5, self.attack[t]))

            # Update defense parameters (positive = worse defense, clamped)
            for t in teams:
                if defense_den[t] > 0:
                    ratio = defense_num[t] / defense_den[t]
                    if ratio > 0:
                        self.defense[t] += math.log(ratio) * 0.5
                        self.defense[t] = max(-5, min(5, self.defense[t]))

            # Update home advantage
            if total_away_expected > 0 and total_home_expected > 0:
                ha_ratio = (total_home_goals / total_home_expected) / (total_away_goals / total_away_expected)
                if ha_ratio > 0:
                    self.home_advantage += math.log(ha_ratio) * 0.3

            # Center attack and defense parameters
            if teams:
                avg_att = sum(self.attack[t] for t in teams) / len(teams)
                avg_def = sum(self.defense[t] for t in teams) / len(teams)
                for t in teams:
                    self.attack[t] -= avg_att
                    self.defense[t] -= avg_def

            # Update avg_goals
            if total_weight > 0:
                self.avg_goals = (total_home_goals + total_away_goals) / (2 * total_weight)
                self.avg_goals = max(0.5, min(self.avg_goals, 3.0))

    def _compute_lambdas(
        self, home: str, away: str, neutral: bool,
    ) -> tuple[float, float]:
        """Compute expected goals for home and away teams."""
        ha = 0.0 if neutral else self.home_advantage
        att_h = self.attack.get(home, 0.0)
        def_h = self.defense.get(home, 0.0)
        att_a = self.attack.get(away, 0.0)
        def_a = self.defense.get(away, 0.0)

        exp_h = max(-10, min(10, att_h - def_a + ha))
        exp_a = max(-10, min(10, att_a - def_h))
        lambda_h = self.avg_goals * math.exp(exp_h)
        lambda_a = self.avg_goals * math.exp(exp_a)

        return max(0.15, min(lambda_h, 6.0)), max(0.15, min(lambda_a, 6.0))

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        lh, la = self._compute_lambdas(home, away, neutral)
        return predict_from_lambdas(lh, la, importance)
