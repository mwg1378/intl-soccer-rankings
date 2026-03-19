import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchInternationalMatches } from "@/lib/api-football";
import { calculateElo, overallRating, combinedRating } from "@/lib/ranking-engine";
import type { MatchImportance } from "@/app/generated/prisma/client";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.API_FOOTBALL_KEY) {
    return NextResponse.json(
      { error: "API_FOOTBALL_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // 1 API call: fetch yesterday's international matches
    const matches = await fetchInternationalMatches();

    if (matches.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No international matches yesterday",
        matchesProcessed: 0,
        apiCallsUsed: 1,
      });
    }

    let processed = 0;

    for (const match of matches) {
      // Find teams by name (fuzzy match could be improved with a mapping table)
      const homeTeam = await prisma.team.findFirst({
        where: {
          OR: [
            { name: match.homeTeamName },
            { name: { contains: match.homeTeamName, mode: "insensitive" } },
          ],
        },
      });
      const awayTeam = await prisma.team.findFirst({
        where: {
          OR: [
            { name: match.awayTeamName },
            { name: { contains: match.awayTeamName, mode: "insensitive" } },
          ],
        },
      });

      if (!homeTeam || !awayTeam) continue;

      // Check for duplicate
      const existing = await prisma.match.findFirst({
        where: {
          date: new Date(match.date),
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
        },
      });
      if (existing) continue;

      // Calculate new Elo ratings
      const eloResult = calculateElo(
        { offensive: homeTeam.eloOffensive, defensive: homeTeam.eloDefensive },
        { offensive: awayTeam.eloOffensive, defensive: awayTeam.eloDefensive },
        {
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          homeScorePenalties: match.homeScorePenalties,
          awayScorePenalties: match.awayScorePenalties,
          matchImportance: match.matchImportance as MatchImportance,
          tournament: match.tournament,
          tournamentStage: match.tournamentStage,
          neutralVenue: match.neutralVenue,
          homeConfederation: homeTeam.confederation,
        }
      );

      // Insert match with before/after Elo
      await prisma.match.create({
        data: {
          date: new Date(match.date),
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          homeScoreExtraTime: match.homeScoreExtraTime,
          awayScoreExtraTime: match.awayScoreExtraTime,
          homeScorePenalties: match.homeScorePenalties,
          awayScorePenalties: match.awayScorePenalties,
          tournament: match.tournament,
          tournamentStage: match.tournamentStage,
          venue: match.venue,
          neutralVenue: match.neutralVenue,
          matchImportance: match.matchImportance as MatchImportance,
          homeEloOffBefore: homeTeam.eloOffensive,
          homeEloDefBefore: homeTeam.eloDefensive,
          awayEloOffBefore: awayTeam.eloOffensive,
          awayEloDefBefore: awayTeam.eloDefensive,
          homeEloOffAfter: eloResult.homeElo.offensive,
          homeEloDefAfter: eloResult.homeElo.defensive,
          awayEloOffAfter: eloResult.awayElo.offensive,
          awayEloDefAfter: eloResult.awayElo.defensive,
          source: match.source,
        },
      });

      // Update team Elo ratings and recalculate combined ratings
      const homeRating = combinedRating(
        eloResult.homeElo.offensive,
        eloResult.homeElo.defensive,
        homeTeam.rosterOffensive,
        homeTeam.rosterDefensive,
        homeTeam.confederation
      );
      const awayRating = combinedRating(
        eloResult.awayElo.offensive,
        eloResult.awayElo.defensive,
        awayTeam.rosterOffensive,
        awayTeam.rosterDefensive,
        awayTeam.confederation
      );

      await prisma.team.update({
        where: { id: homeTeam.id },
        data: {
          eloOffensive: eloResult.homeElo.offensive,
          eloDefensive: eloResult.homeElo.defensive,
          currentOffensiveRating: homeRating.offensive,
          currentDefensiveRating: homeRating.defensive,
          currentOverallRating: homeRating.overall,
        },
      });

      await prisma.team.update({
        where: { id: awayTeam.id },
        data: {
          eloOffensive: eloResult.awayElo.offensive,
          eloDefensive: eloResult.awayElo.defensive,
          currentOffensiveRating: awayRating.offensive,
          currentDefensiveRating: awayRating.defensive,
          currentOverallRating: awayRating.overall,
        },
      });

      processed++;
    }

    // Re-rank all teams after updates
    if (processed > 0) {
      const allTeams = await prisma.team.findMany({
        orderBy: { currentOverallRating: "desc" },
      });

      for (let i = 0; i < allTeams.length; i++) {
        await prisma.team.update({
          where: { id: allTeams[i].id },
          data: { currentRank: i + 1 },
        });
      }

      // Create ranking snapshots for updated teams
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      for (const team of allTeams) {
        await prisma.rankingSnapshot.upsert({
          where: {
            teamId_date: { teamId: team.id, date: today },
          },
          update: {
            rank: allTeams.findIndex((t) => t.id === team.id) + 1,
            overallRating: team.currentOverallRating,
            offensiveRating: team.currentOffensiveRating,
            defensiveRating: team.currentDefensiveRating,
            eloOffensive: team.eloOffensive,
            eloDefensive: team.eloDefensive,
            rosterOffensive: team.rosterOffensive,
            rosterDefensive: team.rosterDefensive,
          },
          create: {
            teamId: team.id,
            date: today,
            rank: allTeams.findIndex((t) => t.id === team.id) + 1,
            overallRating: team.currentOverallRating,
            offensiveRating: team.currentOffensiveRating,
            defensiveRating: team.currentDefensiveRating,
            eloOffensive: team.eloOffensive,
            eloDefensive: team.eloDefensive,
            rosterOffensive: team.rosterOffensive,
            rosterDefensive: team.rosterDefensive,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      matchesProcessed: processed,
      matchesFound: matches.length,
      apiCallsUsed: 1,
    });
  } catch (error) {
    console.error("Daily match ingest failed:", error);
    return NextResponse.json(
      { error: "Ingest failed", details: String(error) },
      { status: 500 }
    );
  }
}
