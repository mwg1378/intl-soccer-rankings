import { prisma } from "@/lib/prisma";
import { RankingsTable } from "@/components/rankings/rankings-table";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "International Soccer Rankings",
  description:
    "International men's soccer rankings powered by 12 backtested models and market-optimized composites, with Dixon-Coles match predictions and World Cup 2026 simulations.",
};

export default async function HomePage() {
  let teams: Awaited<ReturnType<typeof prisma.team.findMany>> = [];

  try {
    teams = await prisma.team.findMany({
      where: { currentRank: { gt: 0 } },
      orderBy: { currentRank: "asc" },
      take: 50,
    });
  } catch {
    // DB not reachable or empty — render empty state
  }

  const lastUpdated = teams[0]?.updatedAt ?? new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">
          International Soccer Rankings
        </h1>
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
            processed through the Elo rating engine.
          </p>
        </div>
      )}

      <div className="text-center">
        <a
          href="/rankings"
          className="text-sm text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline"
        >
          View all 211 teams &rarr;
        </a>
      </div>
    </div>
  );
}
