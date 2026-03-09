import { prisma } from "@/lib/prisma";
import { RankingsTable } from "@/components/rankings/rankings-table";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "International Soccer Rankings",
  description:
    "Current international men's soccer rankings combining Elo ratings with player club performance data.",
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            International Soccer Rankings
          </h1>
          <p className="text-muted-foreground">
            Combining match-based Elo ratings with player club performance
          </p>
        </div>
        {teams.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Last updated:{" "}
            {lastUpdated.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {teams.length > 0 ? (
        <RankingsTable teams={teams} />
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">No rankings data yet</h2>
          <p className="mt-2 text-muted-foreground">
            Rankings will appear here once match data has been imported and
            processed through the Elo rating engine.
          </p>
        </div>
      )}

      <div className="text-center">
        <a
          href="/rankings"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          View all 211 teams &rarr;
        </a>
      </div>
    </div>
  );
}
