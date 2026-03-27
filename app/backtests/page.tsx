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
