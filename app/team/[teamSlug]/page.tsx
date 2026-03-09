import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TeamHeader } from "@/components/team/team-header";
import { TeamTabs } from "@/components/team/team-tabs";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ teamSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = await prisma.team.findUnique({ where: { slug: teamSlug } });
  if (!team) return { title: "Team Not Found" };

  return {
    title: `${team.name} — International Soccer Rankings`,
    description: `${team.name} is ranked #${team.currentRank} with an overall rating of ${team.currentOverallRating.toFixed(0)}.`,
  };
}

export default async function TeamPage({ params }: PageProps) {
  const { teamSlug } = await params;

  const team = await prisma.team.findUnique({
    where: { slug: teamSlug },
  });

  if (!team) notFound();

  const [roster, matches, snapshots] = await Promise.all([
    prisma.teamRoster.findMany({
      where: { teamId: team.id },
      include: {
        player: {
          include: {
            seasonStats: {
              orderBy: { season: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { rosterRole: "asc" },
    }),
    prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      },
      include: {
        homeTeam: { select: { name: true, slug: true } },
        awayTeam: { select: { name: true, slug: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.rankingSnapshot.findMany({
      where: { teamId: team.id },
      orderBy: { date: "asc" },
      select: { date: true, rank: true, overallRating: true },
    }),
  ]);

  const rosterData = roster.map((r) => ({
    id: r.player.id,
    name: r.player.name,
    position: r.player.position,
    detailedPosition: r.player.detailedPosition,
    currentClub: r.player.currentClub,
    currentLeague: r.player.currentLeague,
    marketValue: r.player.marketValue,
    compositeRating: r.player.seasonStats[0]?.compositeRating ?? null,
    caps: r.caps,
    internationalGoals: r.internationalGoals,
    isStartingXI: r.isStartingXI,
    rosterRole: r.rosterRole,
  }));

  const matchData = matches.map((m) => {
    const isHome = m.homeTeamId === team.id;
    const opponent = isHome ? m.awayTeam : m.homeTeam;
    const goalsFor = isHome ? m.homeScore : m.awayScore;
    const goalsAgainst = isHome ? m.awayScore : m.homeScore;
    const eloOffBefore = isHome ? m.homeEloOffBefore : m.awayEloOffBefore;
    const eloOffAfter = isHome ? m.homeEloOffAfter : m.awayEloOffAfter;
    const eloChange =
      eloOffBefore != null && eloOffAfter != null
        ? eloOffAfter - eloOffBefore
        : null;

    return {
      id: m.id,
      date: m.date.toISOString().split("T")[0],
      opponentName: opponent.name,
      opponentSlug: opponent.slug,
      tournament: m.tournament,
      venue: m.neutralVenue ? "N" : isHome ? "H" : "A",
      homeScore: goalsFor,
      awayScore: goalsAgainst,
      isHome,
      eloChange: eloChange ? Math.round(eloChange * 10) / 10 : null,
    };
  });

  const chartData = snapshots.map((s) => ({
    date: s.date.toISOString().split("T")[0],
    rank: s.rank,
    rating: Math.round(s.overallRating),
  }));

  return (
    <div className="space-y-6">
      <TeamHeader team={team} />
      <TeamTabs
        roster={rosterData}
        matches={matchData}
        chartData={chartData}
      />
    </div>
  );
}
