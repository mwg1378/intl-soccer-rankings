"""Model 12: Glicko-2 — Rating deviation (uncertainty) + volatility tracking.

Implementation of the Glicko-2 algorithm by Mark Glickman.
Adapted for soccer with draw handling.
"""

import math
from collections import defaultdict

from backtest.data.loader import MatchRecord
from backtest.models.base import BaseModel, Prediction
from backtest.models.prediction_utils import predict_from_single_rating

TAU = 0.5  # system volatility constant
EPSILON = 0.000001
SCALE_FACTOR = 173.7178  # Glicko-2 scale: 400/ln(10)


def _g(rd: float) -> float:
    """Glicko-2 g function."""
    return 1.0 / math.sqrt(1.0 + 3.0 * rd * rd / (math.pi * math.pi))


def _e(mu: float, mu_j: float, rd_j: float) -> float:
    """Expected score."""
    return 1.0 / (1.0 + math.exp(-_g(rd_j) * (mu - mu_j)))


class Glicko2(BaseModel):
    name = "Glicko-2"

    def __init__(self) -> None:
        self.mu: dict[str, float] = {}      # rating (Glicko-2 scale)
        self.rd: dict[str, float] = {}       # rating deviation
        self.vol: dict[str, float] = {}      # volatility
        self._last_year: str = ""

    def reset(self) -> None:
        self.mu.clear()
        self.rd.clear()
        self.vol.clear()
        self._last_year = ""

    def _ensure_team(self, team: str) -> None:
        if team not in self.mu:
            self.mu[team] = 0.0        # 1500 on Glicko-1 scale
            self.rd[team] = 2.0        # ~350 on Glicko-1 scale
            self.vol[team] = 0.06

    def _glicko1_rating(self, team: str) -> float:
        """Convert to Glicko-1 (1500-centered) scale."""
        return self.mu.get(team, 0.0) * SCALE_FACTOR + 1500.0

    def _increase_rd_for_inactivity(self) -> None:
        """Increase RD at period boundaries to reflect uncertainty growth."""
        for team in self.mu:
            new_rd = math.sqrt(self.rd[team] ** 2 + self.vol[team] ** 2)
            self.rd[team] = min(new_rd, 2.5)

    def _update_team(
        self, team: str,
        opponents: list[tuple[str, float]],  # (opponent, score)
    ) -> None:
        """Update a team's rating based on matches in a period."""
        if not opponents:
            return

        mu = self.mu[team]
        rd = self.rd[team]
        vol = self.vol[team]

        # Step 3: Compute v (estimated variance)
        v_inv = 0.0
        delta_sum = 0.0
        for opp, score in opponents:
            g_val = _g(self.rd[opp])
            e_val = _e(mu, self.mu[opp], self.rd[opp])
            v_inv += g_val * g_val * e_val * (1 - e_val)
            delta_sum += g_val * (score - e_val)

        if v_inv < EPSILON:
            return

        v = 1.0 / v_inv
        delta = v * delta_sum

        # Step 4: Compute new volatility (simplified iteration)
        a = math.log(vol * vol)
        f = lambda x: (
            (math.exp(x) * (delta * delta - rd * rd - v - math.exp(x)))
            / (2.0 * (rd * rd + v + math.exp(x)) ** 2)
            - (x - a) / (TAU * TAU)
        )

        # Bracketing
        A = a
        if delta * delta > rd * rd + v:
            B = math.log(delta * delta - rd * rd - v)
        else:
            k = 1
            while f(a - k * TAU) < 0:
                k += 1
                if k > 100:
                    break
            B = a - k * TAU

        # Illinois algorithm
        fA = f(A)
        fB = f(B)
        for _ in range(50):
            if abs(B - A) < EPSILON:
                break
            C = A + (A - B) * fA / (fB - fA)
            fC = f(C)
            if fC * fB <= 0:
                A = B
                fA = fB
            else:
                fA /= 2.0
            B = C
            fB = fC

        new_vol = math.exp(A / 2.0)

        # Step 5: Update RD
        rd_star = math.sqrt(rd * rd + new_vol * new_vol)

        # Step 6: Update mu and RD
        new_rd = 1.0 / math.sqrt(1.0 / (rd_star * rd_star) + v_inv)
        new_mu = mu + new_rd * new_rd * delta_sum

        self.mu[team] = new_mu
        self.rd[team] = min(new_rd, 2.5)
        self.vol[team] = new_vol

    def train(self, matches: list[MatchRecord]) -> None:
        # Group matches by periods (monthly)
        periods: dict[str, list[MatchRecord]] = defaultdict(list)
        for m in matches:
            period_key = f"{m.date.year}-{m.date.month:02d}"
            periods[period_key] = periods.get(period_key, [])
            periods[period_key].append(m)

        for period_key in sorted(periods.keys()):
            period_matches = periods[period_key]

            # Ensure all teams exist
            for m in period_matches:
                self._ensure_team(m.home_team)
                self._ensure_team(m.away_team)

            # Increase RD for new period
            self._increase_rd_for_inactivity()

            # Collect matches per team
            team_matches: dict[str, list[tuple[str, float]]] = defaultdict(list)
            for m in period_matches:
                if m.home_score > m.away_score:
                    h_score, a_score = 1.0, 0.0
                elif m.home_score < m.away_score:
                    h_score, a_score = 0.0, 1.0
                else:
                    # PSO handling
                    if m.home_penalties and m.away_penalties:
                        if m.home_penalties > m.away_penalties:
                            h_score, a_score = 0.75, 0.25
                        else:
                            h_score, a_score = 0.25, 0.75
                    else:
                        h_score, a_score = 0.5, 0.5

                team_matches[m.home_team].append((m.away_team, h_score))
                team_matches[m.away_team].append((m.home_team, a_score))

            # Update all teams (snapshot ratings first)
            old_mu = dict(self.mu)
            old_rd = dict(self.rd)
            old_vol = dict(self.vol)

            for team, opponents in team_matches.items():
                # Restore pre-period values for consistent updates
                self.mu[team] = old_mu[team]
                self.rd[team] = old_rd[team]
                self.vol[team] = old_vol[team]
                self._update_team(team, opponents)

    def predict(self, home: str, away: str, neutral: bool, importance: str) -> Prediction:
        self._ensure_team(home)
        self._ensure_team(away)

        all_ratings = {t: self._glicko1_rating(t) for t in self.mu}
        return predict_from_single_rating(
            home_rating=self._glicko1_rating(home),
            away_rating=self._glicko1_rating(away),
            all_ratings=all_ratings,
            neutral=neutral,
            importance=importance,
        )
