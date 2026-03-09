"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RosterTable } from "@/components/team/roster-table";
import { MatchHistory } from "@/components/team/match-history";
import { RankingChart } from "@/components/team/ranking-chart";

interface TeamTabsProps {
  roster: Array<{
    id: string;
    name: string;
    position: string;
    detailedPosition: string | null;
    currentClub: string | null;
    currentLeague: string | null;
    marketValue: number | null;
    compositeRating: number | null;
    caps: number;
    internationalGoals: number;
    isStartingXI: boolean;
    rosterRole: string;
  }>;
  matches: Array<{
    id: string;
    date: string;
    opponentName: string;
    opponentSlug: string;
    tournament: string;
    venue: string;
    homeScore: number;
    awayScore: number;
    isHome: boolean;
    eloChange: number | null;
  }>;
  chartData: Array<{
    date: string;
    rank: number;
    rating: number;
  }>;
}

export function TeamTabs({ roster, matches, chartData }: TeamTabsProps) {
  return (
    <Tabs defaultValue="roster" className="w-full">
      <TabsList>
        <TabsTrigger value="roster">
          Roster ({roster.length})
        </TabsTrigger>
        <TabsTrigger value="matches">
          Matches ({matches.length})
        </TabsTrigger>
        <TabsTrigger value="history">Ranking History</TabsTrigger>
      </TabsList>

      <TabsContent value="roster" className="mt-4">
        {roster.length > 0 ? (
          <RosterTable players={roster} />
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No roster data available yet.
          </p>
        )}
      </TabsContent>

      <TabsContent value="matches" className="mt-4">
        {matches.length > 0 ? (
          <MatchHistory matches={matches} />
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No match history available yet.
          </p>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        {chartData.length > 0 ? (
          <RankingChart data={chartData} />
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No ranking history available yet.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
