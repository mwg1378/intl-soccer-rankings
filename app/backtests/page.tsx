import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BacktestsPage() {
  const backtests = await prisma.tournamentBacktest.findMany({
    orderBy: { startDate: "desc" },
  });

  if (backtests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">No backtest data</h2>
        <p className="mt-2 text-gray-400">
          Run <code>npx tsx scripts/backtest-tournaments.ts</code> to generate
          historical tournament backtests.
        </p>
      </div>
    );
  }

  // Compute cross-tournament aggregates
  const totalMatches = backtests.reduce((s, b) => s + b.totalMatches, 0);
  const totalCorrect = backtests.reduce((s, b) => s + b.correctOutcome, 0);
  const weightedBrier = backtests.reduce((s, b) => s + b.brierScore * b.totalMatches, 0) / totalMatches;

  // Aggregate model comparison across all tournaments
  const modelAgg: Record<string, { correct: number; total: number; brierSum: number }> = {};
  for (const bt of backtests) {
    const mc = bt.modelComparison as Record<string, { accuracy: number; brier: number; correct: number; total: number }> | null;
    if (!mc) continue;
    for (const [name, stats] of Object.entries(mc)) {
      const existing = modelAgg[name] ?? { correct: 0, total: 0, brierSum: 0 };
      existing.correct += stats.correct;
      existing.total += stats.total;
      existing.brierSum += stats.brier * stats.total;
      modelAgg[name] = existing;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Historical Tournament Backtests</h1>
        <p className="mt-2 text-sm text-gray-400">
          Walk-forward evaluation of our prediction model against past
          tournaments. Each prediction uses only ratings available before
          that match — no lookahead bias. Click a tournament to see
          match-by-match results.
        </p>
      </div>

      {/* Cross-tournament summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-center">
          <div className="text-3xl font-bold text-[#40C28A]">
            {(totalCorrect / totalMatches * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Overall Accuracy</div>
          <div className="mt-1 text-xs text-gray-500">{totalCorrect}/{totalMatches} matches</div>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-center">
          <div className="text-3xl font-bold">{weightedBrier.toFixed(3)}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Avg Brier Score</div>
          <div className="mt-1 text-xs text-gray-500">Weighted by matches</div>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-center">
          <div className="text-3xl font-bold">{backtests.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Tournaments</div>
          <div className="mt-1 text-xs text-gray-500">{totalMatches} total matches</div>
        </div>
      </div>

      {/* Cross-tournament model comparison */}
      {Object.keys(modelAgg).length > 1 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Model Comparison (All Tournaments)
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="py-2">Model</th>
                  <th className="py-2 text-right">Accuracy</th>
                  <th className="py-2 text-right">Avg Brier</th>
                  <th className="py-2 text-right">Matches</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(modelAgg)
                  .sort((a, b) => (a[1].brierSum / a[1].total) - (b[1].brierSum / b[1].total))
                  .map(([name, stats], i) => {
                    const isBest = i === 0;
                    return (
                      <tr key={name} className={`border-b border-gray-800 ${isBest ? "bg-[#40C28A]/5" : ""}`}>
                        <td className="py-1.5 font-medium">
                          {name}
                          {isBest && <span className="ml-2 text-[10px] text-[#40C28A] uppercase">Best</span>}
                        </td>
                        <td className={`py-1.5 text-right font-mono ${isBest ? "text-[#40C28A] font-semibold" : ""}`}>
                          {(stats.correct / stats.total * 100).toFixed(1)}%
                        </td>
                        <td className={`py-1.5 text-right font-mono ${isBest ? "text-[#40C28A] font-semibold" : ""}`}>
                          {(stats.brierSum / stats.total).toFixed(4)}
                        </td>
                        <td className="py-1.5 text-right text-gray-400">{stats.total}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {backtests.map((bt) => (
          <Link
            key={bt.slug}
            href={`/backtests/${bt.slug}`}
            className="rounded-lg border border-gray-700 bg-gray-900/50 p-5 transition hover:border-gray-500 hover:bg-gray-900"
          >
            <h2 className="text-lg font-semibold">{bt.tournament}</h2>
            <p className="mt-1 text-xs text-gray-400">
              {bt.startDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {bt.endDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-[#40C28A]">
                  {(bt.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400">
                  Accuracy
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">{bt.brierScore.toFixed(3)}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400">
                  Brier
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">{bt.totalMatches}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400">
                  Matches
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              {bt.correctOutcome} of {bt.totalMatches} outcomes predicted
              correctly
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Methodology
        </h2>
        <div className="mt-3 space-y-2 text-sm text-gray-300">
          <p>
            <strong>Walk-forward design:</strong> For each match, predictions
            use pre-match Elo ratings computed from all matches played before
            that game. The model never sees future results.
          </p>
          <p>
            <strong>Brier score:</strong> Measures probability calibration.
            Lower is better. A coin-flip baseline scores 0.667 for three-way
            outcomes (home/draw/away). Scores below that indicate the model
            adds predictive value.
          </p>
          <p>
            <strong>Accuracy:</strong> Percentage of matches where the highest-
            probability outcome matched the actual result. For context, the
            favorite wins roughly 45–55% of international matches.
          </p>
        </div>
      </div>
    </div>
  );
}
