import { prisma } from "@/lib/prisma";
import { predictMatch } from "@/lib/prediction-engine";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const homeTeamId = searchParams.get("homeTeamId");
  const awayTeamId = searchParams.get("awayTeamId");
  const venue = searchParams.get("venue") ?? "NEUTRAL";
  const importance = searchParams.get("importance") ?? "FRIENDLY";

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

  // Get average ratings across all ranked teams for normalization
  const avgResult = await prisma.team.aggregate({
    where: { currentRank: { gt: 0 } },
    _avg: {
      currentOffensiveRating: true,
      currentDefensiveRating: true,
    },
  });

  const avgOff = avgResult._avg.currentOffensiveRating ?? 1500;
  const avgDef = avgResult._avg.currentDefensiveRating ?? 1500;

  const neutralVenue = venue === "NEUTRAL";

  // If venue is AWAY, swap perspective (away team is effectively "home")
  const effectiveHome = venue === "AWAY" ? awayTeam : homeTeam;
  const effectiveAway = venue === "AWAY" ? homeTeam : awayTeam;

  const result = predictMatch({
    homeTeam: {
      offensive: effectiveHome.currentOffensiveRating,
      defensive: effectiveHome.currentDefensiveRating,
    },
    awayTeam: {
      offensive: effectiveAway.currentOffensiveRating,
      defensive: effectiveAway.currentDefensiveRating,
    },
    neutralVenue,
    avgOffensive: avgOff,
    avgDefensive: avgDef,
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
