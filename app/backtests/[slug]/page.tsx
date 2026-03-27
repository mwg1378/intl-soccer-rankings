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
  const groupMatches = matches.filter(
    (m) => m.stage === "TOURNAMENT_GROUP"
  );
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

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/backtests"
          className="text-xs text-gray-400 hover:text-white"
        >
          &larr; All Backtests
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{bt.tournament}</h1>
        <p className="text-sm text-gray-400">
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
          detail="Lower is better"
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

      {/* Biggest upsets */}
      {upsets.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Biggest Surprises
          </h2>
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
                  className="flex items-center gap-3 rounded border border-red-900/30 bg-red-950/20 px-3 py-2 text-sm"
                >
                  <span className="text-red-400 font-mono text-xs w-12">
                    {(confidence * 100).toFixed(0)}% conf
                  </span>
                  <span className="flex-1">
                    <strong>{m.home}</strong> {m.homeScore}–{m.awayScore}{" "}
                    <strong>{m.away}</strong>
                  </span>
                  <span className="text-xs text-gray-400">
                    predicted {m.predictedOutcome === "H" ? m.home : m.predictedOutcome === "A" ? m.away : "Draw"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pre-tournament rankings */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Pre-Tournament Rankings
        </h2>
        <p className="mb-3 text-xs text-gray-400">
          Ratings as of{" "}
          {bt.startDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
          , before the tournament began. Only teams that participated are
          shown.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="py-2 pr-2">#</th>
                <th className="py-2">Team</th>
                <th className="py-2 text-right">Overall</th>
                <th className="py-2 text-right">Off</th>
                <th className="py-2 text-right">Def</th>
                {tournamentRankings.some((r) => r.btRating != null) && (
                  <th className="py-2 text-right">BT</th>
                )}
                {tournamentRankings.some((r) => r.glickoRating != null) && (
                  <th className="py-2 text-right">Glicko</th>
                )}
              </tr>
            </thead>
            <tbody>
              {tournamentRankings.map((r) => (
                <tr
                  key={r.slug}
                  className="border-b border-gray-800 hover:bg-gray-900/50"
                >
                  <td className="py-1.5 pr-2 text-gray-400">{r.rank}</td>
                  <td className="py-1.5 font-medium">
                    <Link
                      href={`/team/${r.slug}`}
                      className="hover:text-[#40C28A]"
                    >
                      {r.team}
                    </Link>
                    <span className="ml-2 text-xs text-gray-500">
                      {r.fifaCode}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {r.overall.toFixed(0)}
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-400">
                    {r.offensive.toFixed(0)}
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-400">
                    {r.defensive.toFixed(0)}
                  </td>
                  {tournamentRankings.some((r) => r.btRating != null) && (
                    <td className="py-1.5 text-right font-mono text-gray-400">
                      {r.btRating?.toFixed(0) ?? "—"}
                    </td>
                  )}
                  {tournamentRankings.some((r) => r.glickoRating != null) && (
                    <td className="py-1.5 text-right font-mono text-gray-400">
                      {r.glickoRating?.toFixed(0) ?? "—"}
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="py-2">Date</th>
                <th className="py-2">Match</th>
                <th className="py-2 text-center">Score</th>
                <th className="py-2 text-right">H%</th>
                <th className="py-2 text-right">D%</th>
                <th className="py-2 text-right">A%</th>
                <th className="py-2 text-right">xG</th>
                <th className="py-2 text-center">Pred</th>
                <th className="py-2 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => {
                const isGroupEnd =
                  i < matches.length - 1 &&
                  m.stage !== matches[i + 1].stage;

                return (
                  <tr
                    key={i}
                    className={`border-b hover:bg-gray-900/50 ${
                      isGroupEnd ? "border-gray-600" : "border-gray-800"
                    }`}
                  >
                    <td className="py-1.5 text-xs text-gray-400 whitespace-nowrap">
                      {m.date.slice(5)}
                    </td>
                    <td className="py-1.5 whitespace-nowrap">
                      <span className="font-medium">{m.homeCode}</span>
                      <span className="mx-1 text-gray-500">v</span>
                      <span className="font-medium">{m.awayCode}</span>
                    </td>
                    <td className="py-1.5 text-center font-mono font-semibold">
                      {m.homeScore}–{m.awayScore}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono ${
                        m.actualOutcome === "H"
                          ? "text-[#40C28A] font-semibold"
                          : "text-gray-400"
                      }`}
                    >
                      {(m.homeWinProb * 100).toFixed(0)}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono ${
                        m.actualOutcome === "D"
                          ? "text-[#40C28A] font-semibold"
                          : "text-gray-400"
                      }`}
                    >
                      {(m.drawProb * 100).toFixed(0)}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono ${
                        m.actualOutcome === "A"
                          ? "text-[#40C28A] font-semibold"
                          : "text-gray-400"
                      }`}
                    >
                      {(m.awayWinProb * 100).toFixed(0)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-gray-400 text-xs">
                      {m.homeXg.toFixed(1)}–{m.awayXg.toFixed(1)}
                    </td>
                    <td className="py-1.5 text-center text-xs">
                      {m.predictedOutcome === "H"
                        ? m.homeCode
                        : m.predictedOutcome === "A"
                          ? m.awayCode
                          : "Draw"}
                    </td>
                    <td className="py-1.5 text-center">
                      {m.correct ? (
                        <span className="text-[#40C28A]" title="Correct">
                          &#10003;
                        </span>
                      ) : (
                        <span className="text-red-400" title="Incorrect">
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
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-center">
      <div
        className={`text-2xl font-bold ${highlight ? "text-[#40C28A]" : ""}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400">
        {label}
      </div>
      {detail && (
        <div className="mt-1 text-xs text-gray-500">{detail}</div>
      )}
    </div>
  );
}
