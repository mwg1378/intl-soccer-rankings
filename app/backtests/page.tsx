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
        <p className="mt-2 text-gray-500">
          Run <code>npx tsx scripts/backtest-tournaments.ts</code> to generate
          historical tournament backtests.
        </p>
      </div>
    );
  }

  // Compute cross-tournament aggregates
  const totalMatches = backtests.reduce((s, b) => s + b.totalMatches, 0);
  const totalCorrect = backtests.reduce((s, b) => s + b.correctOutcome, 0);
  const weightedBrier =
    backtests.reduce((s, b) => s + b.brierScore * b.totalMatches, 0) /
    totalMatches;

  // Aggregate model comparison across all tournaments
  const modelAgg: Record<
    string,
    { correct: number; total: number; brierSum: number }
  > = {};
  for (const bt of backtests) {
    const mc = bt.modelComparison as Record<
      string,
      { accuracy: number; brier: number; correct: number; total: number }
    > | null;
    if (!mc) continue;
    for (const [name, stats] of Object.entries(mc)) {
      const existing = modelAgg[name] ?? {
        correct: 0,
        total: 0,
        brierSum: 0,
      };
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
        <p className="mt-2 text-sm text-gray-500">
          Walk-forward evaluation of our prediction model against past
          tournaments. Each prediction uses only ratings available before that
          match — no lookahead bias. Click a tournament to see match-by-match
          results.
        </p>
      </div>

      {/* Cross-tournament summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#399F49]">
            {((totalCorrect / totalMatches) * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Overall Accuracy
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {totalCorrect}/{totalMatches} matches
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#399F49]">
            {weightedBrier.toFixed(3)}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Avg Brier Score
          </div>
          <div className="mt-1 text-xs text-gray-400">
            vs 0.667 coin-flip baseline
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#399F49]">
            {backtests.length}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Tournaments
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {totalMatches} total matches
          </div>
        </div>
      </div>

      {/* Cross-tournament model comparison */}
      {Object.keys(modelAgg).length > 1 && (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="tr-table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">Accuracy</th>
                <th className="text-right">Avg Brier</th>
                <th className="text-right">Matches</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(modelAgg)
                .sort(
                  (a, b) =>
                    a[1].brierSum / a[1].total - b[1].brierSum / b[1].total
                )
                .map(([name, stats], i) => {
                  const isBest = i === 0;
                  return (
                    <tr key={name}>
                      <td className="font-medium">
                        {name}
                        {isBest && (
                          <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 uppercase">
                            Best
                          </span>
                        )}
                      </td>
                      <td
                        className={`text-right font-mono ${isBest ? "font-semibold" : ""}`}
                      >
                        {((stats.correct / stats.total) * 100).toFixed(1)}%
                      </td>
                      <td
                        className={`text-right font-mono ${isBest ? "font-semibold" : ""}`}
                      >
                        {(stats.brierSum / stats.total).toFixed(4)}
                      </td>
                      <td className="text-right text-gray-500">
                        {stats.total}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tournament cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {backtests.map((bt) => (
          <Link
            key={bt.slug}
            href={`/backtests/${bt.slug}`}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow"
          >
            <h2 className="text-lg font-semibold">{bt.tournament}</h2>
            <p className="mt-1 text-xs text-gray-500">
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
                <div className="text-2xl font-bold text-[#399F49]">
                  {(bt.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500">
                  Accuracy
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {bt.brierScore.toFixed(3)}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500">
                  Brier
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">{bt.totalMatches}</div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500">
                  Matches
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-400">
              {bt.correctOutcome} of {bt.totalMatches} outcomes predicted
              correctly
            </div>
          </Link>
        ))}
      </div>

      {/* Methodology */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Methodology
        </h2>
        <div className="mt-3 space-y-2 text-sm text-gray-600">
          <p>
            <strong>Walk-forward design:</strong> For each match, predictions
            use pre-match Elo ratings computed from all matches played before
            that game. The model never sees future results.
          </p>
          <p>
            <strong>Brier score:</strong> Measures probability calibration.
            Lower is better. A coin-flip baseline scores 0.667 for three-way
            outcomes (home/draw/away). Our score of {weightedBrier.toFixed(3)}{" "}
            indicates the model adds meaningful predictive value.
          </p>
          <p>
            <strong>Accuracy:</strong> Percentage of matches where the
            highest-probability outcome matched the actual result. For context,
            always picking the favorite yields roughly 45% accuracy in
            international football.
          </p>
        </div>
      </div>
    </div>
  );
}
