"""Results tables, charts, and analysis generation."""

import csv
import os
from pathlib import Path

from backtest.evaluation.walk_forward import ModelResult


def generate_composite_rankings(
    results: list[ModelResult],
    output_dir: Path,
) -> None:
    """Write composite_rankings.csv — all models ranked by composite score."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Sort by composite score descending
    ranked = sorted(results, key=lambda r: r.composite, reverse=True)

    path = output_dir / "composite_rankings.csv"
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "rank", "model", "composite_score",
            "brier", "margin_mae", "goals_mae",
            "accuracy", "n_matches", "time_seconds",
        ])
        for i, r in enumerate(ranked, 1):
            om = r.overall_metrics
            writer.writerow([
                i, r.model_name, f"{r.composite:.4f}",
                f"{om.brier:.4f}", f"{om.margin_mae:.3f}",
                f"{om.goals_mae:.3f}", f"{om.accuracy:.4f}",
                om.n_matches, f"{r.elapsed_seconds:.1f}",
            ])

    print(f"\nComposite rankings saved to {path}")


def generate_per_tournament_breakdown(
    results: list[ModelResult],
    output_dir: Path,
) -> None:
    """Write per_tournament_breakdown.csv — model × tournament metrics."""
    output_dir.mkdir(parents=True, exist_ok=True)

    path = output_dir / "per_tournament_breakdown.csv"
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "model", "tournament", "n_matches",
            "brier", "margin_mae", "goals_mae", "accuracy",
        ])
        for r in results:
            for tr in r.tournament_results:
                m = tr.metrics
                writer.writerow([
                    r.model_name, tr.tournament, m.n_matches,
                    f"{m.brier:.4f}", f"{m.margin_mae:.3f}",
                    f"{m.goals_mae:.3f}", f"{m.accuracy:.4f}",
                ])


def generate_summary_table(results: list[ModelResult]) -> str:
    """Generate a formatted summary table for console output."""
    ranked = sorted(results, key=lambda r: r.composite, reverse=True)

    lines = [
        "",
        "=" * 90,
        f"{'Rank':<5} {'Model':<30} {'Composite':>10} {'Brier':>8} {'MarginMAE':>10} {'Acc':>7} {'N':>6}",
        "-" * 90,
    ]

    for i, r in enumerate(ranked, 1):
        om = r.overall_metrics
        lines.append(
            f"{i:<5} {r.model_name:<30} {r.composite:>10.4f} "
            f"{om.brier:>8.4f} {om.margin_mae:>10.3f} "
            f"{om.accuracy:>7.1%} {om.n_matches:>6}"
        )

    lines.append("=" * 90)
    return "\n".join(lines)


def generate_ensemble_comparison(
    individual_results: list[ModelResult],
    ensemble_result: ModelResult,
    output_dir: Path,
) -> None:
    """Write ensemble_comparison.csv — ensemble vs best individual."""
    output_dir.mkdir(parents=True, exist_ok=True)

    best_individual = max(individual_results, key=lambda r: r.composite)

    path = output_dir / "ensemble_comparison.csv"
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["metric", "best_individual", "ensemble", "improvement"])
        for metric_name, get_metric in [
            ("composite", lambda r: r.composite),
            ("brier", lambda r: r.overall_metrics.brier),
            ("margin_mae", lambda r: r.overall_metrics.margin_mae),
            ("goals_mae", lambda r: r.overall_metrics.goals_mae),
            ("accuracy", lambda r: r.overall_metrics.accuracy),
        ]:
            best_val = get_metric(best_individual)
            ens_val = get_metric(ensemble_result)
            if best_val != 0:
                improvement = (ens_val - best_val) / abs(best_val) * 100
            else:
                improvement = 0
            writer.writerow([
                metric_name,
                f"{best_val:.4f}",
                f"{ens_val:.4f}",
                f"{improvement:+.2f}%",
            ])

    print(f"\nEnsemble comparison saved to {path}")
    print(f"  Best individual: {best_individual.model_name} (composite={best_individual.composite:.4f})")
    print(f"  Ensemble: {ensemble_result.model_name} (composite={ensemble_result.composite:.4f})")
