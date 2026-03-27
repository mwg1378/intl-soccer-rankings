import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface MatchResult {
  date: string;
  home: string;
  homeCode: string;
  homeSlug: string;
  away: string;
  awayCode: string;
  awaySlug: string;
  stage: string;
  homeScore: number;
  awayScore: number;
  actualOutcome: string;
  predictedOutcome: string;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  homeXg: number;
  awayXg: number;
  correct: boolean;
  brier: number;
  topScorelines: Array<{ home: number; away: number; prob: number }>;
}

interface Ranking {
  rank: number;
  team: string;
  slug: string;
  fifaCode: string;
  confederation: string;
  overall: number;
  offensive: number;
  defensive: number;
  btRating: number | null;
  btRank: number | null;
  glickoRating: number | null;
  glickoRank: number | null;
}

// Baselines for context
const COIN_FLIP_BRIER = 0.667; // 3-way uniform
const FAVORITE_BASELINE_ACC = 0.45; // always picking the favorite

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function TournamentBacktestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const bt = await prisma.tournamentBacktest.findUnique({
    where: { slug },
  });

  if (!bt) return notFound();

  const matches = bt.matches as unknown as MatchResult[];
  const rankings = bt.rankings as unknown as Ranking[];
  const modelComparison = bt.modelComparison as Record<
    string,
    {
      accuracy: number;
      brier: number;
      logLoss: number;
      correct: number;
      total: number;
    }
  > | null;

  // Find teams that participated in this tournament
  const tournamentTeamSlugs = new Set<string>();
  for (const m of matches) {
    tournamentTeamSlugs.add(m.homeSlug);
    tournamentTeamSlugs.add(m.awaySlug);
  }

  const tournamentRankings = rankings.filter((r) =>
    tournamentTeamSlugs.has(r.slug)
  );

  // Group matches by stage
  const groupMatches = matches.filter((m) => m.stage === "TOURNAMENT_GROUP");
  const knockoutMatches = matches.filter(
    (m) => m.stage === "TOURNAMENT_KNOCKOUT"
  );

  const groupCorrect = groupMatches.filter((m) => m.correct).length;
  const koCorrect = knockoutMatches.filter((m) => m.correct).length;

  // Biggest upsets: matches where the model was most confident but wrong
  const upsets = [...matches]
    .filter((m) => !m.correct)
    .sort((a, b) => {
      const aConf = Math.max(a.homeWinProb, a.drawProb, a.awayWinProb);
      const bConf = Math.max(b.homeWinProb, b.drawProb, b.awayWinProb);
      return bConf - aConf;
    })
    .slice(0, 5);

  const brierBeat = COIN_FLIP_BRIER - bt.brierScore;
  const accBeat = bt.accuracy - FAVORITE_BASELINE_ACC;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/backtests"
          className="text-xs text-gray-500 hover:text-[#1a2b4a]"
        >
          &larr; All Backtests
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{bt.tournament}</h1>
        <p className="text-sm text-gray-500">
          {bt.startDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}{" "}
          –{" "}
          {bt.endDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Verdict */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
        <p className="text-sm text-gray-700">
          <strong>
            Model accuracy of {(bt.accuracy * 100).toFixed(1)}%
          </strong>{" "}
          {accBeat > 0 ? (
            <>
              beat the always-pick-favorite baseline ({(FAVORITE_BASELINE_ACC * 100).toFixed(0)}%) by{" "}
              <strong>{(accBeat * 100).toFixed(1)} points</strong>.
            </>
          ) : (
            <>
              was below the always-pick-favorite baseline ({(FAVORITE_BASELINE_ACC * 100).toFixed(0)}%).
            </>
          )}{" "}
          Brier score of {bt.brierScore.toFixed(3)}{" "}
          {brierBeat > 0 ? (
            <>
              beat the coin-flip baseline ({COIN_FLIP_BRIER.toFixed(3)}) by{" "}
              <strong>{brierBeat.toFixed(3)}</strong>.
            </>
          ) : (
            <>
              was near the coin-flip baseline ({COIN_FLIP_BRIER.toFixed(3)}).
            </>
          )}
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricCard
          label="Accuracy"
          value={`${(bt.accuracy * 100).toFixed(1)}%`}
          detail={`${bt.correctOutcome}/${bt.totalMatches}`}
          highlight
        />
        <MetricCard
          label="Brier Score"
          value={bt.brierScore.toFixed(3)}
          detail={`vs ${COIN_FLIP_BRIER} baseline`}
        />
        <MetricCard
          label="Log Loss"
          value={bt.logLoss.toFixed(3)}
          detail="Lower is better"
        />
        <MetricCard
          label="Group Stage"
          value={`${groupMatches.length > 0 ? ((groupCorrect / groupMatches.length) * 100).toFixed(0) : 0}%`}
          detail={`${groupCorrect}/${groupMatches.length}`}
        />
        <MetricCard
          label="Knockout"
          value={`${knockoutMatches.length > 0 ? ((koCorrect / knockoutMatches.length) * 100).toFixed(0) : 0}%`}
          detail={`${koCorrect}/${knockoutMatches.length}`}
        />
      </div>

      {/* Model comparison */}
      {modelComparison && Object.keys(modelComparison).length > 1 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Model Comparison</h2>
          <p className="mb-3 text-xs text-gray-500">
            Head-to-head performance of different rating models on this
            tournament. &ldquo;Elo (walk-forward)&rdquo; updates ratings after
            each match; snapshot-based models use pre-tournament ratings for all
            matches.
          </p>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="tr-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="text-right">Accuracy</th>
                  <th className="text-right">Brier</th>
                  <th className="text-right">Log Loss</th>
                  <th className="text-right">Correct</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(modelComparison)
                  .sort((a, b) => a[1].brier - b[1].brier)
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
                          {(stats.accuracy * 100).toFixed(1)}%
                        </td>
                        <td
                          className={`text-right font-mono ${isBest ? "font-semibold" : ""}`}
                        >
                          {stats.brier.toFixed(4)}
                        </td>
                        <td className="text-right font-mono text-gray-500">
                          {stats.logLoss.toFixed(4)}
                        </td>
                        <td className="text-right text-gray-500">
                          {stats.correct}/{stats.total}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Biggest upsets */}
      {upsets.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Biggest Surprises</h2>
          <div className="space-y-2">
            {upsets.map((m, i) => {
              const confidence = Math.max(
                m.homeWinProb,
                m.drawProb,
                m.awayWinProb
              );
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-red-600 w-12">
                    {(confidence * 100).toFixed(0)}% conf
                  </span>
                  <span className="flex-1">
                    <strong>{m.home}</strong> {m.homeScore}–{m.awayScore}{" "}
                    <strong>{m.away}</strong>
                  </span>
                  <span className="text-xs text-gray-500">
                    predicted{" "}
                    {m.predictedOutcome === "H"
                      ? m.home
                      : m.predictedOutcome === "A"
                        ? m.away
                        : "Draw"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pre-tournament rankings */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Pre-Tournament Rankings</h2>
        <p className="mb-3 text-xs text-gray-500">
          Ratings before the tournament began. Only participating teams shown.
        </p>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="tr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th className="text-right">Overall</th>
                <th className="text-right">Off</th>
                <th className="text-right">Def</th>
                {tournamentRankings.some((r) => r.btRating != null) && (
                  <th className="text-right">BT</th>
                )}
              </tr>
            </thead>
            <tbody>
              {tournamentRankings.map((r) => (
                <tr key={r.slug}>
                  <td className="text-gray-500">{r.rank}</td>
                  <td className="font-medium">
                    <Link
                      href={`/team/${r.slug}`}
                      className="hover:text-[#1a2b4a] hover:underline"
                    >
                      {r.team}
                    </Link>
                    <span className="ml-2 text-xs text-gray-400">
                      {r.fifaCode}
                    </span>
                  </td>
                  <td className="text-right font-mono">
                    {r.overall.toFixed(0)}
                  </td>
                  <td className="text-right font-mono text-gray-500">
                    {r.offensive.toFixed(0)}
                  </td>
                  <td className="text-right font-mono text-gray-500">
                    {r.defensive.toFixed(0)}
                  </td>
                  {tournamentRankings.some((r) => r.btRating != null) && (
                    <td className="text-right font-mono text-gray-500">
                      {r.btRating?.toFixed(0) ?? "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match-by-match results */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Match-by-Match Predictions
        </h2>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="tr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Match</th>
                <th className="text-right">Score</th>
                <th className="text-right">H%</th>
                <th className="text-right">D%</th>
                <th className="text-right">A%</th>
                <th className="text-right">xG</th>
                <th className="text-right">Pred</th>
                <th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => {
                const isGroupEnd =
                  i < matches.length - 1 && m.stage !== matches[i + 1].stage;

                return (
                  <tr
                    key={i}
                    className={isGroupEnd ? "separator-row" : ""}
                  >
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(m.date)}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="font-medium">{m.homeCode}</span>
                      <span className="mx-1 text-gray-400">v</span>
                      <span className="font-medium">{m.awayCode}</span>
                    </td>
                    <td className="text-right font-mono font-semibold">
                      {m.homeScore}–{m.awayScore}
                    </td>
                    <td
                      className={`text-right font-mono ${
                        m.actualOutcome === "H"
                          ? "font-semibold text-green-700"
                          : "text-gray-500"
                      }`}
                    >
                      {(m.homeWinProb * 100).toFixed(0)}
                    </td>
                    <td
                      className={`text-right font-mono ${
                        m.actualOutcome === "D"
                          ? "font-semibold text-green-700"
                          : "text-gray-500"
                      }`}
                    >
                      {(m.drawProb * 100).toFixed(0)}
                    </td>
                    <td
                      className={`text-right font-mono ${
                        m.actualOutcome === "A"
                          ? "font-semibold text-green-700"
                          : "text-gray-500"
                      }`}
                    >
                      {(m.awayWinProb * 100).toFixed(0)}
                    </td>
                    <td className="text-right font-mono text-gray-400 text-xs">
                      {m.homeXg.toFixed(1)}–{m.awayXg.toFixed(1)}
                    </td>
                    <td className="text-right text-xs">
                      {m.predictedOutcome === "H"
                        ? m.homeCode
                        : m.predictedOutcome === "A"
                          ? m.awayCode
                          : "Draw"}
                    </td>
                    <td className="text-right">
                      {m.correct ? (
                        <span className="text-green-600" title="Correct">
                          &#10003;
                        </span>
                      ) : (
                        <span className="text-red-500" title="Incorrect">
                          &#10007;
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  highlight,
}: {
  label: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
      <div
        className={`text-2xl font-bold ${highlight ? "text-[#1a2b4a]" : ""}`}
      >
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      {detail && <div className="mt-1 text-xs text-gray-400">{detail}</div>}
    </div>
  );
}
