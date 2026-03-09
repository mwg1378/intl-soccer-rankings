"use client";

import { useState } from "react";
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

const tabs = [
  { key: "roster", label: "Roster" },
  { key: "matches", label: "Matches" },
  { key: "history", label: "Ranking History" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function TeamTabs({ roster, matches, chartData }: TeamTabsProps) {
  const [active, setActive] = useState<TabKey>("roster");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px transition-colors ${
              active === tab.key
                ? "text-[#1a2b4a] border-[#1a2b4a]"
                : "text-gray-400 border-transparent hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
            {tab.key === "roster" && ` (${roster.length})`}
            {tab.key === "matches" && ` (${matches.length})`}
          </button>
        ))}
      </div>

      {active === "roster" && (
        roster.length > 0 ? (
          <RosterTable players={roster} />
        ) : (
          <p className="py-8 text-center text-gray-400">
            No roster data available yet.
          </p>
        )
      )}

      {active === "matches" && (
        matches.length > 0 ? (
          <MatchHistory matches={matches} />
        ) : (
          <p className="py-8 text-center text-gray-400">
            No match history available yet.
          </p>
        )
      )}

      {active === "history" && (
        chartData.length > 0 ? (
          <RankingChart data={chartData} />
        ) : (
          <p className="py-8 text-center text-gray-400">
            No ranking history available yet.
          </p>
        )
      )}
    </div>
  );
}
