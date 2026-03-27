import { prisma } from "@/lib/prisma";
import { RankingsTable } from "@/components/rankings/rankings-table";
import { CONSENSUS_ODDS } from "@/lib/market-odds";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "International Soccer Rankings — World Cup 2026 Predictions",
  description:
    "Who wins the 2026 FIFA World Cup? Data-driven predictions powered by 12 backtested models, 100K Monte Carlo simulations, and market-optimized composites.",
};

export default async function HomePage() {
  const [teams, sim] = await Promise.all([
    prisma.team.findMany({
      where: { currentRank: { gt: 0 } },
      orderBy: { currentRank: "asc" },
      take: 50,
    }).catch(() => [] as Awaited<ReturnType<typeof prisma.team.findMany>>),
    prisma.worldCupSimulation.findFirst({
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
  ]);

  const lastUpdated = teams[0]?.updatedAt ?? new Date();

  // Get championship probabilities from simulation
  const advancementOdds = (sim?.advancementOdds ?? {}) as Record<string, {
    name: string;
    group: string;
    probChampion: number;
    probFinal: number;
    probSF: number;
    probQF: number;
  }>;

  // Build slug lookup from teams we already fetched
  const slugByName = new Map(teams.map((t) => [t.name, t.slug]));

  // Build top favorites with model + market odds
  const favorites = Object.values(advancementOdds)
    .filter((a) => a.probChampion > 0.005)
    .sort((a, b) => b.probChampion - a.probChampion)
    .slice(0, 8)
    .map((a) => ({
      name: a.name,
      slug: slugByName.get(a.name) ?? a.name.toLowerCase().replace(/\s+/g, "-"),
      group: a.group,
      modelProb: a.probChampion,
      marketProb: CONSENSUS_ODDS[a.name] ?? 0,
      probFinal: a.probFinal,
      probSF: a.probSF,
    }));

  const maxProb = favorites[0]?.modelProb ?? 0.15;

  return (
    <div className="space-y-8">
      {/* Hero: World Cup Favorites */}
      {favorites.length > 0 && (
        <section>
          <div className="mb-4">
            <h1 className="text-2xl font-bold tracking-tight">
              Who Wins the 2026 World Cup?
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Championship probabilities from{" "}
              {sim ? sim.iterations.toLocaleString() : "100,000"} Monte Carlo
              simulations, powered by 12 backtested ranking models.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.map((f, idx) => (
              <Link
                key={f.name}
                href={`/team/${f.slug}`}
                className="block rounded border border-gray-200 p-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 font-mono text-xs font-bold text-gray-600">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-sm">{f.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">Grp {f.group}</span>
                </div>

                {/* Championship probability bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Win tournament</span>
                    <span className="font-mono font-bold tabular-nums">
                      {(f.modelProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#1a2b4a] transition-all duration-500"
                      style={{ width: `${(f.modelProb / maxProb) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Secondary stats */}
                <div className="mt-2 flex gap-3 text-[10px] text-gray-400">
                  <span>Final: <strong className="text-gray-600">{(f.probFinal * 100).toFixed(0)}%</strong></span>
                  <span>SF: <strong className="text-gray-600">{(f.probSF * 100).toFixed(0)}%</strong></span>
                  {f.marketProb > 0 && (
                    <span>
                      Mkt: <strong className="text-gray-600">{(f.marketProb * 100).toFixed(1)}%</strong>
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <p className="mt-2 text-[10px] text-gray-400">
            Mkt = consensus of{" "}
            <Link href="/world-cup/odds" className="underline underline-offset-2">
              sportsbook &amp; Polymarket odds
            </Link>{" "}
            (Mar 2026).
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <Link
              href="/world-cup/advancement"
              className="text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline"
            >
              All teams advancement odds &rarr;
            </Link>
            <Link
              href="/world-cup/odds"
              className="text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline"
            >
              Model vs Market comparison &rarr;
            </Link>
            <Link
              href="/predict"
              className="text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline"
            >
              Predict any match &rarr;
            </Link>
          </div>
        </section>
      )}

      {/* Rankings Table */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">
            Rankings
          </h2>
          {teams.length > 0 && (
            <span className="text-xs text-gray-400">
              Updated{" "}
              {lastUpdated.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {teams.length > 0 ? (
          <RankingsTable teams={teams} />
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <h2 className="text-lg font-semibold">No rankings data yet</h2>
            <p className="mt-2 text-gray-400">
              Rankings will appear here once match data has been imported and
              processed through the rating engine.
            </p>
          </div>
        )}

        <div className="text-center mt-3">
          <Link
            href="/rankings"
            className="text-sm text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline"
          >
            View all 211 teams &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
