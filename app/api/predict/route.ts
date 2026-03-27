import { prisma } from "@/lib/prisma";
import { predictMatch } from "@/lib/prediction-engine";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const homeTeamId = searchParams.get("homeTeamId");
  const awayTeamId = searchParams.get("awayTeamId");
  const venue = searchParams.get("venue") ?? "NEUTRAL";
  const matchImportance = searchParams.get("matchImportance") as
    | "FRIENDLY" | "QUALIFIER" | "NATIONS_LEAGUE" | "TOURNAMENT_GROUP" | "TOURNAMENT_KNOCKOUT"
    | null;

  if (!homeTeamId || !awayTeamId) {
    return NextResponse.json(
      { error: "homeTeamId and awayTeamId are required" },
      { status: 400 }
    );
  }

  if (homeTeamId === awayTeamId) {
    return NextResponse.json(
      { error: "Teams must be different" },
      { status: 400 }
    );
  }

  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: homeTeamId } }),
    prisma.team.findUnique({ where: { id: awayTeamId } }),
  ]);

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Compute mean and std of Grid-Optimized ratings across all ranked teams
  // (matches what the WC simulation and group-matches API use)
  const allTeams = await prisma.team.findMany({
    where: { currentRank: { gt: 0 } },
    select: { gridOptOff: true, gridOptDef: true },
  });

  const n = allTeams.length;
  const avgOff = allTeams.reduce((s, t) => s + t.gridOptOff, 0) / n;
  const avgDef = allTeams.reduce((s, t) => s + t.gridOptDef, 0) / n;
  const stdOff = Math.sqrt(
    allTeams.reduce((s, t) => s + (t.gridOptOff - avgOff) ** 2, 0) / n
  );
  const stdDef = Math.sqrt(
    allTeams.reduce((s, t) => s + (t.gridOptDef - avgDef) ** 2, 0) / n
  );

  const neutralVenue = venue === "NEUTRAL";

  // Use Grid-Optimized composite ratings (70% Combined + 30% BT)
  const effectiveHome = venue === "AWAY" ? awayTeam : homeTeam;
  const effectiveAway = venue === "AWAY" ? homeTeam : awayTeam;

  const result = predictMatch({
    homeTeam: {
      offensive: effectiveHome.gridOptOff,
      defensive: effectiveHome.gridOptDef,
    },
    awayTeam: {
      offensive: effectiveAway.gridOptOff,
      defensive: effectiveAway.gridOptDef,
    },
    neutralVenue,
    matchImportance: matchImportance ?? undefined,
    avgOffensive: avgOff,
    avgDefensive: avgDef,
    stdOffensive: stdOff,
    stdDefensive: stdDef,
  });

  // If we swapped for AWAY venue, swap the results back
  if (venue === "AWAY") {
    return NextResponse.json({
      homeExpectedGoals: result.awayExpectedGoals,
      awayExpectedGoals: result.homeExpectedGoals,
      homeWinProb: result.awayWinProb,
      drawProb: result.drawProb,
      awayWinProb: result.homeWinProb,
      scoreMatrix: result.scoreMatrix[0].map((_: number, i: number) =>
        result.scoreMatrix.map((row: number[]) => row[i])
      ),
      topScorelines: result.topScorelines.map(
        (s: { homeGoals: number; awayGoals: number; probability: number }) => ({
          homeGoals: s.awayGoals,
          awayGoals: s.homeGoals,
          probability: s.probability,
        })
      ),
    });
  }

  return NextResponse.json(result);
}
