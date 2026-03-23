#!/usr/bin/env python3
"""Main CLI entry point for running the backtesting pipeline.

Usage:
    cd backtest
    python scripts/run_backtest.py                     # Run all 25 models
    python scripts/run_backtest.py --models "Vanilla Elo,Dixon-Coles"
    python scripts/run_backtest.py --tournaments "WC,Euro"
    python scripts/run_backtest.py --ensemble           # Include ensemble
"""

import argparse
import sys
import time
from pathlib import Path

# Add parent dir to path so imports work
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backtest.data.loader import load_matches
from backtest.data.tournaments import get_tournament_windows
from backtest.evaluation.walk_forward import (
    ModelResult,
    compute_composite_scores,
    run_walk_forward,
)
from backtest.evaluation.report import (
    generate_composite_rankings,
    generate_ensemble_comparison,
    generate_per_tournament_breakdown,
    generate_summary_table,
)
from backtest.models.base import BaseModel


def get_all_models() -> list[BaseModel]:
    """Instantiate all 25 prediction models."""
    models: list[BaseModel] = []

    # Category 1: Elo Variants (5 models)
    from backtest.models.elo.vanilla_elo import VanillaElo
    from backtest.models.elo.fifa_elo import FifaElo
    from backtest.models.elo.goal_weighted_elo import GoalWeightedElo
    from backtest.models.elo.margin_optimized_elo import MarginOptimizedElo
    from backtest.models.elo.recency_weighted_elo import RecencyWeightedElo
    models.extend([VanillaElo(), FifaElo(), GoalWeightedElo(),
                    MarginOptimizedElo(), RecencyWeightedElo()])

    # Category 2: Score Prediction / Poisson Family (6 models)
    from backtest.models.poisson.independent_poisson import IndependentPoisson
    from backtest.models.poisson.dixon_coles import DixonColes
    from backtest.models.poisson.bivariate_poisson import BivariatePoisson
    from backtest.models.poisson.zero_inflated import ZeroInflatedPoisson
    from backtest.models.poisson.negative_binomial import NegativeBinomial
    from backtest.models.poisson.ordered_probit import OrderedProbit
    models.extend([IndependentPoisson(), DixonColes(), BivariatePoisson(),
                    ZeroInflatedPoisson(), NegativeBinomial(), OrderedProbit()])

    # Category 3: Advanced Rating Systems (4 models)
    from backtest.models.ratings.glicko2 import Glicko2
    from backtest.models.ratings.trueskill_model import TrueSkillModel
    from backtest.models.ratings.whole_history import WholeHistoryRating
    from backtest.models.ratings.berrar import BerrarRating
    models.extend([Glicko2(), TrueSkillModel(), WholeHistoryRating(), BerrarRating()])

    # Category 4: Dynamic / Hybrid (3 models)
    from backtest.models.dynamic.importance_weighted_pi import ImportanceWeightedPi
    from backtest.models.dynamic.kalman_filter import KalmanFilter
    from backtest.models.dynamic.fivethirtyeight import FiveThirtyEightStyle
    models.extend([ImportanceWeightedPi(), KalmanFilter(), FiveThirtyEightStyle()])

    # Category 5: Feature-Based (3 models)
    from backtest.models.feature_based.market_value import MarketValueModel
    from backtest.models.feature_based.squad_depth import SquadDepthModel
    from backtest.models.feature_based.composite_features import CompositeFeatures
    models.extend([MarketValueModel(), SquadDepthModel(), CompositeFeatures()])

    # Category 6: Machine Learning (4 models)
    from backtest.models.ml.logistic_l1 import LogisticL1
    from backtest.models.ml.random_forest import RandomForestModel
    from backtest.models.ml.xgboost_model import XGBoostModel
    from backtest.models.ml.catboost_model import CatBoostModel
    models.extend([LogisticL1(), RandomForestModel(), XGBoostModel(), CatBoostModel()])

    return models


def filter_models(all_models: list[BaseModel], names: str) -> list[BaseModel]:
    """Filter models by comma-separated name substrings."""
    name_parts = [n.strip().lower() for n in names.split(",")]
    return [m for m in all_models if any(n in m.name.lower() for n in name_parts)]


def main():
    parser = argparse.ArgumentParser(description="Backtest soccer prediction models")
    parser.add_argument("--models", type=str, default=None,
                       help="Comma-separated model name substrings to run")
    parser.add_argument("--tournaments", type=str, default=None,
                       help="Comma-separated tournament name substrings")
    parser.add_argument("--ensemble", action="store_true",
                       help="Include stacked ensemble")
    parser.add_argument("--start-date", type=str, default="2002-01-01",
                       help="Earliest match date for training data")
    parser.add_argument("--output-dir", type=str, default=None,
                       help="Output directory for results")
    parser.add_argument("--quiet", action="store_true",
                       help="Suppress per-tournament output")
    args = parser.parse_args()

    output_dir = Path(args.output_dir) if args.output_dir else Path(__file__).resolve().parents[1] / "results"

    print("=" * 60)
    print("International Soccer Prediction Model Backtest")
    print("=" * 60)

    # Load data
    print(f"\nLoading matches from {args.start_date}...")
    all_matches = load_matches(start_date=args.start_date)
    print(f"  Loaded {len(all_matches)} matches")

    # Get tournament windows
    tournament_names = args.tournaments.split(",") if args.tournaments else None
    windows = get_tournament_windows(tournament_names)
    print(f"  {len(windows)} tournament windows")

    # Get models
    all_models = get_all_models()
    if args.models:
        models = filter_models(all_models, args.models)
    else:
        models = all_models
    print(f"  {len(models)} models to evaluate\n")

    # Run walk-forward for each model
    results: list[ModelResult] = []
    total_start = time.time()

    for i, model in enumerate(models, 1):
        print(f"\n[{i}/{len(models)}] {model.name}")
        print("-" * 40)
        result = run_walk_forward(
            model, all_matches, windows,
            verbose=not args.quiet,
        )
        results.append(result)

    # Compute composite scores
    results = compute_composite_scores(results)

    # Print summary
    print(generate_summary_table(results))

    total_elapsed = time.time() - total_start
    print(f"\nTotal time: {total_elapsed:.1f}s")

    # Run ensemble if requested
    ensemble_result = None
    if args.ensemble and len(results) >= 3:
        print("\n\nRunning Stacked Ensemble...")
        print("-" * 40)
        from backtest.ensemble.stacker import StackedEnsemble

        ensemble = StackedEnsemble(models)
        ensemble_result = run_walk_forward(
            ensemble, all_matches, windows,
            verbose=not args.quiet,
        )
        # Compute composite for ensemble in context of all results
        all_with_ensemble = results + [ensemble_result]
        all_with_ensemble = compute_composite_scores(all_with_ensemble)
        ensemble_result = all_with_ensemble[-1]

    # Generate reports
    print("\n\nGenerating reports...")
    generate_composite_rankings(results, output_dir)
    generate_per_tournament_breakdown(results, output_dir)

    if ensemble_result:
        generate_ensemble_comparison(results, ensemble_result, output_dir)

    # Print top 3 for Phase 10 porting
    ranked = sorted(results, key=lambda r: r.composite, reverse=True)
    print("\n\nTOP 3 MODELS (candidates for TypeScript port):")
    print("=" * 50)
    for i, r in enumerate(ranked[:3], 1):
        om = r.overall_metrics
        print(f"  {i}. {r.model_name}")
        print(f"     Composite: {r.composite:.4f}")
        print(f"     Brier: {om.brier:.4f}, Accuracy: {om.accuracy:.1%}")
        print()


if __name__ == "__main__":
    main()
