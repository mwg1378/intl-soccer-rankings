"""Evaluation metrics: Brier score, margin MAE, goals MAE, composite score."""

import math
from dataclasses import dataclass, field

from backtest.data.loader import MatchRecord
from backtest.models.base import Prediction


def _brier_weight(match: MatchRecord) -> float:
    """World Cup (non-qualifier) matches count 3x."""
    t = match.tournament.lower()
    if "world cup" in t and "qualification" not in t:
        return 3.0
    return 1.0


@dataclass
class MatchMetrics:
    """Metrics for a single match prediction."""
    brier: float
    margin_ae: float
    goals_ae: float
    correct_outcome: bool
    weight: float = 1.0


@dataclass
class AggregateMetrics:
    """Aggregated metrics over multiple matches."""
    brier: float = 0.0
    margin_mae: float = 0.0
    goals_mae: float = 0.0
    accuracy: float = 0.0
    n_matches: int = 0


def compute_match_metrics(pred: Prediction, match: MatchRecord) -> MatchMetrics:
    """Compute all metrics for a single prediction vs actual result.

    PSO matches are treated as draws for Brier/accuracy — the model predicts
    regulation-time outcome, so a match that goes to penalties was a draw in
    regulation regardless of what the CSV score says (which may include ET goals).
    """
    # If match went to PSO, treat as draw for outcome evaluation
    is_pso = match.shootout_winner is not None
    if is_pso:
        actual_h = 0.0
        actual_d = 1.0
        actual_a = 0.0
        outcome = "D"
    else:
        actual_h = 1.0 if match.home_win else 0.0
        actual_d = 1.0 if match.is_draw else 0.0
        actual_a = 1.0 if match.away_win else 0.0
        outcome = match.outcome

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

    # Correct outcome (PSO = draw)
    correct = pred.predicted_outcome == outcome

    return MatchMetrics(
        brier=brier,
        margin_ae=margin_ae,
        goals_ae=goals_ae,
        correct_outcome=correct,
        weight=_brier_weight(match),
    )


def aggregate_metrics(match_metrics: list[MatchMetrics]) -> AggregateMetrics:
    """Aggregate match-level metrics into weighted averages.

    World Cup matches are weighted 3x (via MatchMetrics.weight).
    """
    if not match_metrics:
        return AggregateMetrics()

    total_w = sum(m.weight for m in match_metrics)
    if total_w < 1e-10:
        return AggregateMetrics(n_matches=len(match_metrics))

    return AggregateMetrics(
        brier=sum(m.brier * m.weight for m in match_metrics) / total_w,
        margin_mae=sum(m.margin_ae * m.weight for m in match_metrics) / total_w,
        goals_mae=sum(m.goals_ae * m.weight for m in match_metrics) / total_w,
        accuracy=sum((1 if m.correct_outcome else 0) * m.weight for m in match_metrics) / total_w,
        n_matches=len(match_metrics),
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
