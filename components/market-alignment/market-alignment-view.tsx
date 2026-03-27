"use client";

import { useState } from "react";

interface TeamComparison {
  team: string;
  modelProb: number;
  consensusProb: number;
  sportsbookProb: number;
  polymarketProb: number;
  diff: number;
  absDiff: number;
  direction: "MODEL_HIGHER" | "MODEL_LOWER" | "ALIGNED";
  category: "strong_agree" | "agree" | "mild_disagree" | "disagree" | "strong_disagree";
}

interface AlignmentMetrics {
  mse: number;
  spearmanCorrelation: number;
  top5Overlap: number;
  top10Overlap: number;
  meanAbsDiff: number;
}

interface DisagreementAnalysis {
  team: string;
  modelProb: number;
  consensusProb: number;
  diff: number;
  direction: "MODEL_HIGHER" | "MODEL_LOWER";
  severity: "mild" | "notable" | "significant";
  justification: string;
}

interface MarketObservation {
  team: string;
  category: "source_divergence" | "model_insight" | "market_shift" | "playoff_uncertainty";
  headline: string;
  analysis: string;
}

interface MarketAlignmentViewProps {
  comparisons: TeamComparison[];
  metrics: AlignmentMetrics;
  disagreements: DisagreementAnalysis[];
  observations: MarketObservation[];
  marketSources: {
    sportsbook: { name: string; updated: string; source: string };
    polymarket: { name: string; updated: string; volume: string; source: string };
  };
  simIterations: number;
  simDate: string;
}

function pct(v: number): string {
  if (v === 0) return "\u2014";
  if (v < 0.001) return "<0.1%";
  return (v * 100).toFixed(1) + "%";
}

// Diff colors are magnitude-based (how big), with +/- sign for direction.
// Red intensity = magnitude of disagreement, regardless of direction.
function diffCell(diff: number): { text: string; className: string } {
  const pp = diff * 100;
  const abs = Math.abs(pp);
  if (abs < 0.5) return { text: "~", className: "text-gray-300" };
  const sign = pp > 0 ? "+" : "";
  const text = `${sign}${pp.toFixed(1)}`;
  if (abs >= 5) return { text, className: "text-red-600 font-semibold" };
  if (abs >= 3) return { text, className: "text-orange-600 font-medium" };
  if (abs >= 1.5) return { text, className: "text-amber-600" };
  return { text, className: "text-gray-500" };
}

function categoryBadge(cat: TeamComparison["category"]): { label: string; className: string } {
  switch (cat) {
    case "strong_agree": return { label: "Strong agree", className: "bg-green-100 text-green-700" };
    case "agree": return { label: "Agree", className: "bg-green-50 text-green-600" };
    case "mild_disagree": return { label: "Mild disagree", className: "bg-yellow-50 text-yellow-700" };
    case "disagree": return { label: "Disagree", className: "bg-orange-100 text-orange-700" };
    case "strong_disagree": return { label: "Strong disagree", className: "bg-red-100 text-red-700" };
  }
}

function severityBadge(severity: DisagreementAnalysis["severity"]): { className: string } {
  switch (severity) {
    case "mild": return { className: "border-l-yellow-400" };
    case "notable": return { className: "border-l-orange-400" };
    case "significant": return { className: "border-l-red-500" };
  }
}

function mseQuality(mse: number): { label: string; className: string } {
  if (mse < 0.0003) return { label: "Excellent", className: "text-green-600" };
  if (mse < 0.0005) return { label: "Good", className: "text-green-500" };
  if (mse < 0.001) return { label: "Fair", className: "text-yellow-600" };
  return { label: "Poor", className: "text-red-500" };
}

const CATEGORY_LABELS: Record<MarketObservation["category"], { label: string; color: string }> = {
  source_divergence: { label: "Source Divergence", color: "bg-purple-100 text-purple-700" },
  model_insight: { label: "Model Insight", color: "bg-emerald-100 text-emerald-700" },
  market_shift: { label: "Market Shift", color: "bg-amber-100 text-amber-700" },
  playoff_uncertainty: { label: "Playoff", color: "bg-sky-100 text-sky-700" },
};

export function MarketAlignmentView({
  comparisons,
  metrics,
  disagreements,
  observations,
  marketSources,
  simIterations,
  simDate,
}: MarketAlignmentViewProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const displayed = showAll ? comparisons : comparisons.slice(0, 20);
  const disagreeTeams = new Set(disagreements.map(d => d.team));
  const mseQ = mseQuality(metrics.mse);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Market Alignment</h1>
        <p className="text-sm text-gray-400 mt-1">
          How our model&apos;s World Cup 2026 championship probabilities compare against
          sportsbook consensus and prediction markets. We use disagreements as signal, not noise.
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-gray-400">MSE vs Market</div>
          <div className="text-lg font-bold mt-0.5">{metrics.mse.toFixed(6)}</div>
          <div className={`text-[10px] font-medium ${mseQ.className}`}>
            {mseQ.label} (below 0.001 = strong fit)
          </div>
        </div>
        <MetricCard label="Rank Correlation" value={metrics.spearmanCorrelation.toFixed(3)} subtitle="1.0 = perfect agreement" />
        <MetricCard label="Top-5 Overlap" value={`${(metrics.top5Overlap * 100).toFixed(0)}%`} subtitle="same 5 favorites" />
        <MetricCard label="Top-10 Overlap" value={`${(metrics.top10Overlap * 100).toFixed(0)}%`} subtitle="same top 10" />
        <MetricCard label="Avg Probability Gap" value={`${(metrics.meanAbsDiff * 100).toFixed(2)}pp`} subtitle="per-team average" />
      </div>

      {/* Comparison table — uses site .tr-table pattern */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Team-by-Team Comparison</h2>
        <div className="overflow-x-auto">
          <table className="tr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th className="text-right">Our Model</th>
                <th className="text-right">Consensus</th>
                <th className="text-right hidden md:table-cell">Sportsbook</th>
                <th className="text-right hidden md:table-cell">Polymarket</th>
                <th className="text-right" title="Model probability minus market consensus, in percentage points">Diff</th>
                <th>Agreement</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c, i) => {
                const diff = diffCell(c.diff);
                const badge = categoryBadge(c.category);
                const hasDetail = disagreeTeams.has(c.team);
                return (
                  <tr
                    key={c.team}
                    className={hasDetail ? "cursor-pointer" : ""}
                    onClick={hasDetail ? () => setExpandedTeam(expandedTeam === c.team ? null : c.team) : undefined}
                  >
                    <td className="text-gray-400">{i + 1}</td>
                    <td className="font-medium">{c.team}</td>
                    <td className="text-right tabular-nums">{pct(c.modelProb)}</td>
                    <td className="text-right tabular-nums">{pct(c.consensusProb)}</td>
                    <td className="text-right tabular-nums text-gray-500 hidden md:table-cell">{pct(c.sportsbookProb)}</td>
                    <td className="text-right tabular-nums text-gray-500 hidden md:table-cell">{pct(c.polymarketProb)}</td>
                    <td className={`text-right tabular-nums ${diff.className}`}>{diff.text}</td>
                    <td>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {comparisons.length > 20 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline"
          >
            {showAll ? "Show top 20" : `Show all ${comparisons.length} teams`}
          </button>
        )}
      </div>

      {/* Disagreement analysis */}
      {disagreements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-1">Notable Disagreements</h2>
          <p className="text-sm text-gray-400 mb-4">
            Teams where our model diverges meaningfully from market consensus.
            These are interesting signals, not necessarily errors.
          </p>
          <div className="space-y-3">
            {disagreements
              .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
              .map((d) => {
                const sev = severityBadge(d.severity);
                const isExpanded = expandedTeam === d.team;
                return (
                  <div
                    key={d.team}
                    className={`border-l-4 ${sev.className} bg-gray-50 rounded-r-lg px-4 py-3 cursor-pointer`}
                    onClick={() => setExpandedTeam(isExpanded ? null : d.team)}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{d.team}</span>
                        <span className="text-xs text-gray-400">
                          Model: {pct(d.modelProb)} | Market: {pct(d.consensusProb)}
                        </span>
                      </div>
                      <span className={`text-sm font-mono ${d.diff > 0 ? "text-red-600" : "text-blue-600"}`}>
                        {d.diff > 0 ? "+" : ""}{(d.diff * 100).toFixed(1)}pp
                        {d.direction === "MODEL_HIGHER" ? " (model higher)" : " (market higher)"}
                      </span>
                    </div>
                    {isExpanded && (
                      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                        {d.justification}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Market Observations */}
      {observations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-1">Market Intelligence</h2>
          <p className="text-sm text-gray-400 mb-4">
            Qualitative analysis of sportsbook vs prediction market pricing, playoff uncertainty,
            and where our model&apos;s perspective adds signal.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {observations.map((obs) => {
              const cat = CATEGORY_LABELS[obs.category];
              return (
                <div key={`${obs.team}-${obs.category}`} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${cat.color}`}>
                      {cat.label}
                    </span>
                    <span className="text-xs text-gray-400">{obs.team}</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{obs.headline}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{obs.analysis}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      <div className="text-xs text-gray-400 space-y-1 pt-4 border-t">
        <p>
          Model: Grid-Optimized Composite (70% Elo+Roster, 30% Bradley-Terry) |{" "}
          {simIterations.toLocaleString()} Monte Carlo iterations |{" "}
          Simulated {new Date(simDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
        <p>
          Sportsbook odds: {marketSources.sportsbook.source} (updated {marketSources.sportsbook.updated}) |{" "}
          Polymarket: {marketSources.polymarket.volume} traded (updated {marketSources.polymarket.updated})
        </p>
        <p>
          Consensus = average of sportsbook implied probability and Polymarket probability, normalized.
          Diff = model minus consensus (positive = our model is more bullish on that team).
        </p>
        <p className="text-yellow-600">
          Note: Our composite weights and prediction sensitivity were calibrated against these same
          market odds. The metrics above measure in-sample calibration fit, not independent validation.
          See backtesting results for out-of-sample predictive accuracy.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      <div className="text-[10px] text-gray-300">{subtitle}</div>
    </div>
  );
}
