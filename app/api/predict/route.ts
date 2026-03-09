import { prisma } from "@/lib/prisma";
import { predictMatch } from "@/lib/prediction-engine";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const homeTeamId = searchParams.get("homeTeamId");
  const awayTeamId = searchParams.get("awayTeamId");
  const venue = searchParams.get("venue") ?? "NEUTRAL";

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

  // Compute mean and std of raw Elo ratings across all ranked teams
  const allTeams = await prisma.team.findMany({
    where: { currentRank: { gt: 0 } },
    select: { eloOffensive: true, eloDefensive: true },
  });

  const n = allTeams.length;
  const avgOff = allTeams.reduce((s, t) => s + t.eloOffensive, 0) / n;
  const avgDef = allTeams.reduce((s, t) => s + t.eloDefensive, 0) / n;
  const stdOff = Math.sqrt(
    allTeams.reduce((s, t) => s + (t.eloOffensive - avgOff) ** 2, 0) / n
  );
  const stdDef = Math.sqrt(
    allTeams.reduce((s, t) => s + (t.eloDefensive - avgDef) ** 2, 0) / n
  );

  const neutralVenue = venue === "NEUTRAL";

  // Use raw Elo ratings for predictions (more variance = better discrimination)
  const effectiveHome = venue === "AWAY" ? awayTeam : homeTeam;
  const effectiveAway = venue === "AWAY" ? homeTeam : awayTeam;

  const result = predictMatch({
    homeTeam: {
      offensive: effectiveHome.eloOffensive,
      defensive: effectiveHome.eloDefensive,
    },
    awayTeam: {
      offensive: effectiveAway.eloOffensive,
      defensive: effectiveAway.eloDefensive,
    },
    neutralVenue,
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
