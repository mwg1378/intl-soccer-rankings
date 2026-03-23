"""Evaluation metrics: Brier score, margin MAE, goals MAE, composite score."""

import math
from dataclasses import dataclass, field

from backtest.data.loader import MatchRecord
from backtest.models.base import Prediction


@dataclass
class MatchMetrics:
    """Metrics for a single match prediction."""
    brier: float
    margin_ae: float
    goals_ae: float
    correct_outcome: bool


@dataclass
class AggregateMetrics:
    """Aggregated metrics over multiple matches."""
    brier: float = 0.0
    margin_mae: float = 0.0
    goals_mae: float = 0.0
    accuracy: float = 0.0
    n_matches: int = 0


def compute_match_metrics(pred: Prediction, match: MatchRecord) -> MatchMetrics:
    """Compute all metrics for a single prediction vs actual result."""
    # Brier score: sum of squared errors on the 3 outcome probabilities
    actual_h = 1.0 if match.home_win else 0.0
    actual_d = 1.0 if match.is_draw else 0.0
    actual_a = 1.0 if match.away_win else 0.0

    brier = (
        (pred.home_win_prob - actual_h) ** 2
        + (pred.draw_prob - actual_d) ** 2
        + (pred.away_win_prob - actual_a) ** 2
    )

    # Margin absolute error: |predicted_margin - actual_margin|
    pred_margin = pred.home_xg - pred.away_xg
    actual_margin = match.home_score - match.away_score
    margin_ae = abs(pred_margin - actual_margin)

    # Goals absolute error: |pred_total - actual_total|
    pred_total = pred.home_xg + pred.away_xg
    actual_total = match.home_score + match.away_score
    goals_ae = abs(pred_total - actual_total)

    # Correct outcome
    correct = pred.predicted_outcome == match.outcome

    return MatchMetrics(
        brier=brier,
        margin_ae=margin_ae,
        goals_ae=goals_ae,
        correct_outcome=correct,
    )


def aggregate_metrics(match_metrics: list[MatchMetrics]) -> AggregateMetrics:
    """Aggregate match-level metrics into averages."""
    if not match_metrics:
        return AggregateMetrics()

    n = len(match_metrics)
    return AggregateMetrics(
        brier=sum(m.brier for m in match_metrics) / n,
        margin_mae=sum(m.margin_ae for m in match_metrics) / n,
        goals_mae=sum(m.goals_ae for m in match_metrics) / n,
        accuracy=sum(1 for m in match_metrics if m.correct_outcome) / n,
        n_matches=n,
    )


def composite_score(
    brier: float, margin_mae: float, goals_mae: float,
    all_briers: list[float], all_margins: list[float], all_goals: list[float],
) -> float:
    """Compute composite score for a single model within a tournament.

    Normalizes each metric across all models (min-max → [0, 1])
    then weights: 60% outcome + 25% margin + 15% goals.
    """
    def normalize(val: float, all_vals: list[float]) -> float:
        mn, mx = min(all_vals), max(all_vals)
        if mx - mn < 1e-10:
            return 0.5
        return (mx - val) / (mx - mn)  # lower = better → higher normalized

    norm_b = normalize(brier, all_briers)
    norm_m = normalize(margin_mae, all_margins)
    norm_g = normalize(goals_mae, all_goals)

    return 0.60 * norm_b + 0.25 * norm_m + 0.15 * norm_g
