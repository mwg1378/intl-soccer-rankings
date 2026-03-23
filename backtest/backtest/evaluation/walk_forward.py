"""Walk-forward evaluation loop for backtesting prediction models."""

import time
from dataclasses import dataclass, field

from backtest.data.loader import MatchRecord, load_matches
from backtest.data.tournaments import TournamentWindow, get_tournament_windows
from backtest.evaluation.metrics import (
    AggregateMetrics,
    MatchMetrics,
    aggregate_metrics,
    composite_score,
    compute_match_metrics,
)
from backtest.models.base import BaseModel, Prediction


@dataclass
class TournamentResult:
    tournament: str
    metrics: AggregateMetrics
    match_predictions: list[tuple[MatchRecord, Prediction, MatchMetrics]]


@dataclass
class ModelResult:
    model_name: str
    tournament_results: list[TournamentResult] = field(default_factory=list)
    overall_metrics: AggregateMetrics = field(default_factory=AggregateMetrics)
    composite: float = 0.0
    elapsed_seconds: float = 0.0


def run_walk_forward(
    model: BaseModel,
    all_matches: list[MatchRecord],
    windows: list[TournamentWindow],
    verbose: bool = True,
) -> ModelResult:
    """Run walk-forward backtesting for a single model across all tournament windows."""
    result = ModelResult(model_name=model.name)
    start_time = time.time()

    all_match_metrics: list[MatchMetrics] = []

    for window in windows:
        # Split: train on everything before tournament, test on tournament matches
        train_matches = [m for m in all_matches if m.date < window.start]
        test_matches = [
            m for m in all_matches
            if window.start <= m.date <= window.end
            and window.matches_tournament(m.tournament)
        ]

        if len(test_matches) < window.min_matches:
            if verbose:
                print(f"  {window.name}: skipped ({len(test_matches)} matches < {window.min_matches})")
            continue

        # Train the model
        model.reset()
        model.train(train_matches)

        # Predict each test match
        match_preds: list[tuple[MatchRecord, Prediction, MatchMetrics]] = []
        for m in test_matches:
            try:
                pred = model.predict(m.home_team, m.away_team, m.neutral, m.importance)
                metrics = compute_match_metrics(pred, m)
                match_preds.append((m, pred, metrics))
                all_match_metrics.append(metrics)
            except Exception as e:
                if verbose:
                    print(f"    Error predicting {m.home_team} vs {m.away_team}: {e}")

        agg = aggregate_metrics([mp[2] for mp in match_preds])
        result.tournament_results.append(TournamentResult(
            tournament=window.name,
            metrics=agg,
            match_predictions=match_preds,
        ))

        if verbose:
            print(
                f"  {window.name}: {agg.n_matches} matches, "
                f"Brier={agg.brier:.4f}, MarginMAE={agg.margin_mae:.2f}, "
                f"GoalsMAE={agg.goals_mae:.2f}, Acc={agg.accuracy:.1%}"
            )

    result.overall_metrics = aggregate_metrics(all_match_metrics)
    result.elapsed_seconds = time.time() - start_time

    if verbose:
        om = result.overall_metrics
        print(
            f"  OVERALL: {om.n_matches} matches, "
            f"Brier={om.brier:.4f}, MarginMAE={om.margin_mae:.2f}, "
            f"GoalsMAE={om.goals_mae:.2f}, Acc={om.accuracy:.1%}, "
            f"Time={result.elapsed_seconds:.1f}s"
        )

    return result


def compute_composite_scores(results: list[ModelResult]) -> list[ModelResult]:
    """Compute composite scores across all models and tournaments.

    For each tournament, normalize metrics across all models (min-max),
    then weight: 60% outcome + 25% margin + 15% goals.
    Final score = match-weighted average across tournaments.
    """
    # Collect all tournament names that have results from at least 2 models
    tournament_names: set[str] = set()
    for r in results:
        for tr in r.tournament_results:
            tournament_names.add(tr.tournament)

    # For each model, accumulate weighted composite scores
    for r in results:
        weighted_sum = 0.0
        total_weight = 0.0

        for tname in tournament_names:
            # Gather metrics from all models for this tournament
            all_briers = []
            all_margins = []
            all_goals = []
            model_metrics: dict[str, AggregateMetrics] = {}

            for r2 in results:
                for tr in r2.tournament_results:
                    if tr.tournament == tname and tr.metrics.n_matches > 0:
                        all_briers.append(tr.metrics.brier)
                        all_margins.append(tr.metrics.margin_mae)
                        all_goals.append(tr.metrics.goals_mae)
                        model_metrics[r2.model_name] = tr.metrics

            if r.model_name not in model_metrics or len(all_briers) < 2:
                continue

            m = model_metrics[r.model_name]
            score = composite_score(
                m.brier, m.margin_mae, m.goals_mae,
                all_briers, all_margins, all_goals,
            )
            weight = m.n_matches
            weighted_sum += score * weight
            total_weight += weight

        r.composite = weighted_sum / total_weight if total_weight > 0 else 0.0

    return results
