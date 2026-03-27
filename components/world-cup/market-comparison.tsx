"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TeamComparison, AlignmentMetrics, DisagreementAnalysis } from "@/lib/market-alignment";

interface MarketComparisonProps {
  comparisons: TeamComparison[];
  metrics: AlignmentMetrics;
  disagreements: DisagreementAnalysis[];
}

function pct(v: number): string {
  if (v === 0) return "—";
  if (v < 0.001) return "<0.1%";
  return (v * 100).toFixed(1) + "%";
}

function diffDisplay(diff: number): { text: string; color: string } {
  const pp = diff * 100;
  const abs = Math.abs(pp);
  if (abs < 0.5) return { text: "aligned", color: "text-gray-400" };
  const sign = pp > 0 ? "+" : "";
  const color = pp > 1.5 ? "text-green-600 font-semibold" : pp < -1.5 ? "text-red-500 font-semibold" : "text-gray-500";
  return { text: `${sign}${pp.toFixed(1)}pp`, color };
}

function categoryBadge(cat: TeamComparison["category"]): { label: string; classes: string } {
  switch (cat) {
    case "strong_agree": return { label: "Strong Agree", classes: "bg-green-100 text-green-700" };
    case "agree": return { label: "Agree", classes: "bg-green-50 text-green-600" };
    case "mild_disagree": return { label: "Mild Disagree", classes: "bg-amber-50 text-amber-700" };
    case "disagree": return { label: "Disagree", classes: "bg-orange-100 text-orange-700" };
    case "strong_disagree": return { label: "Strong Disagree", classes: "bg-red-100 text-red-700" };
  }
}

export function MarketComparison({ comparisons, metrics, disagreements }: MarketComparisonProps) {
  const [showAll, setShowAll] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const displayed = showAll ? comparisons : comparisons.slice(0, 25);
  const filtered = filterCat
    ? displayed.filter((c) => c.category === filterCat)
    : displayed;

  return (
    <div className="space-y-6">
      {/* Alignment Summary */}
      <div>
        <h2 className="text-xl font-semibold">Model vs Market</h2>
        <p className="text-sm text-gray-400">
          Comparing our Monte Carlo simulation probabilities against sportsbook and Polymarket consensus odds.
        </p>
      </div>

      {/* Metrics cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="MSE" value={metrics.mse.toFixed(6)} description="Mean squared error" />
        <MetricCard label="Spearman r" value={metrics.spearmanCorrelation.toFixed(3)} description="Rank correlation" />
        <MetricCard label="Top-5 Overlap" value={`${(metrics.top5Overlap * 100).toFixed(0)}%`} description="Same top 5 teams" />
        <MetricCard label="Top-10 Overlap" value={`${(metrics.top10Overlap * 100).toFixed(0)}%`} description="Same top 10 teams" />
        <MetricCard label="Mean Abs Diff" value={`${(metrics.meanAbsDiff * 100).toFixed(2)}pp`} description="Avg probability gap" />
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilterCat(null)}
          className={`px-2.5 py-1 text-xs font-semibold rounded ${
            !filterCat ? "bg-[#399F49] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {["strong_agree", "agree", "mild_disagree", "disagree", "strong_disagree"].map((cat) => {
          const badge = categoryBadge(cat as TeamComparison["category"]);
          return (
            <button
              key={cat}
              onClick={() => setFilterCat(cat === filterCat ? null : cat)}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                filterCat === cat ? "bg-[#399F49] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {badge.label}
            </button>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="tr-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th className="text-right">Model</th>
              <th className="text-right">Sportsbook</th>
              <th className="text-right">Polymarket</th>
              <th className="text-right">Consensus</th>
              <th className="text-right">Diff</th>
              <th className="text-center">Agreement</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, idx) => {
              const d = diffDisplay(c.diff);
              const badge = categoryBadge(c.category);
              return (
                <tr key={c.team}>
                  <td className="text-gray-400 font-mono">{idx + 1}</td>
                  <td className="font-medium">{c.team}</td>
                  <td className="text-right font-mono">{pct(c.modelProb)}</td>
                  <td className="text-right font-mono text-gray-500">{pct(c.sportsbookProb)}</td>
                  <td className="text-right font-mono text-gray-500">{pct(c.polymarketProb)}</td>
                  <td className="text-right font-mono">{pct(c.consensusProb)}</td>
                  <td className={cn("text-right font-mono", d.color)}>{d.text}</td>
                  <td className="text-center">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.classes}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!showAll && comparisons.length > 25 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-gray-400 underline hover:text-gray-600"
        >
          Show all {comparisons.length} teams
        </button>
      )}

      {/* Notable disagreements */}
      {disagreements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Notable Disagreements</h3>
          <p className="text-sm text-gray-400">
            Where our model and the market meaningfully diverge, with explanations.
          </p>
          <div className="space-y-3">
            {disagreements.map((d) => (
              <div key={d.team} className="rounded border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">{d.team}</span>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    d.direction === "MODEL_HIGHER" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                    {d.direction === "MODEL_HIGHER" ? "Model Higher" : "Market Higher"}
                  </span>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    d.severity === "significant" ? "bg-red-100 text-red-700"
                      : d.severity === "notable" ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {d.severity}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500 mb-2">
                  <span>Model: <strong className="text-gray-800">{pct(d.modelProb)}</strong></span>
                  <span>Market: <strong className="text-gray-800">{pct(d.consensusProb)}</strong></span>
                  <span>Gap: <strong className={d.diff > 0 ? "text-green-600" : "text-red-500"}>
                    {d.diff > 0 ? "+" : ""}{(d.diff * 100).toFixed(1)}pp
                  </strong></span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {d.justification}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-bold font-mono tabular-nums">{value}</div>
      <div className="text-[10px] text-gray-400">{description}</div>
    </div>
  );
}
