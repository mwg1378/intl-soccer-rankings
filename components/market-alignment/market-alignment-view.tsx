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

interface MarketAlignmentViewProps {
  comparisons: TeamComparison[];
  metrics: AlignmentMetrics;
  disagreements: DisagreementAnalysis[];
  marketSources: {
    sportsbook: { name: string; updated: string; source: string };
    polymarket: { name: string; updated: string; volume: string; source: string };
  };
  simIterations: number;
  simDate: string;
}

function pct(v: number): string {
  if (v === 0) return "—";
  if (v < 0.001) return "<0.1%";
  return (v * 100).toFixed(1) + "%";
}

function diffCell(diff: number): { text: string; className: string } {
  const pp = diff * 100;
  const abs = Math.abs(pp);
  if (abs < 0.5) return { text: "~", className: "text-gray-300" };
  const sign = pp > 0 ? "+" : "";
  const text = `${sign}${pp.toFixed(1)}`;
  if (abs >= 5) return { text, className: pp > 0 ? "text-red-600 font-semibold" : "text-blue-600 font-semibold" };
  if (abs >= 3) return { text, className: pp > 0 ? "text-red-500" : "text-blue-500" };
  if (abs >= 1.5) return { text, className: pp > 0 ? "text-orange-500" : "text-sky-500" };
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

export function MarketAlignmentView({
  comparisons,
  metrics,
  disagreements,
  marketSources,
  simIterations,
  simDate,
}: MarketAlignmentViewProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const displayed = showAll ? comparisons : comparisons.slice(0, 20);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Market Alignment</h1>
        <p className="text-sm text-gray-400 mt-1">
          How our model&apos;s World Cup 2026 championship probabilities compare against
          sportsbook consensus and prediction markets.
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="MSE vs Market" value={metrics.mse.toFixed(6)} subtitle="lower = better" />
        <MetricCard label="Rank Correlation" value={metrics.spearmanCorrelation.toFixed(3)} subtitle="Spearman rho" />
        <MetricCard label="Top-5 Overlap" value={`${(metrics.top5Overlap * 100).toFixed(0)}%`} subtitle="same 5 favorites" />
        <MetricCard label="Top-10 Overlap" value={`${(metrics.top10Overlap * 100).toFixed(0)}%`} subtitle="same top 10" />
        <MetricCard label="Mean Abs Diff" value={`${(metrics.meanAbsDiff * 100).toFixed(2)}pp`} subtitle="avg probability gap" />
      </div>

      {/* Comparison table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Team-by-Team Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-2 text-right">Our Model</th>
                <th className="py-2 pr-2 text-right">Consensus</th>
                <th className="py-2 pr-2 text-right">Sportsbook</th>
                <th className="py-2 pr-2 text-right">Polymarket</th>
                <th className="py-2 pr-2 text-right">Diff (pp)</th>
                <th className="py-2 pl-2">Agreement</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c, i) => {
                const diff = diffCell(c.diff);
                const badge = categoryBadge(c.category);
                return (
                  <tr
                    key={c.team}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedTeam(expandedTeam === c.team ? null : c.team)}
                  >
                    <td className="py-1.5 pr-4 text-gray-400">{i + 1}</td>
                    <td className="py-1.5 pr-4 font-medium">{c.team}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{pct(c.modelProb)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{pct(c.consensusProb)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-gray-500">{pct(c.sportsbookProb)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-gray-500">{pct(c.polymarketProb)}</td>
                    <td className={`py-1.5 pr-2 text-right tabular-nums ${diff.className}`}>{diff.text}</td>
                    <td className="py-1.5 pl-2">
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
            These are interesting signals — not necessarily errors. Click to read analysis.
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
                    <div className="flex items-center justify-between">
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
          Diff = model probability minus consensus (positive = our model is more bullish).
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
