"use client";

import { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const GROUP_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

interface MatchPrediction {
  home: string;
  away: string;
  homeXg: number;
  awayXg: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  topScorelines: Array<{ home: number; away: number; prob: number }>;
  isPlayoffTeam: boolean;
  playoffPath?: string;
}

interface GroupData {
  teams: string[];
  playoffTeams?: string[];
  playoffPath?: string;
  matches: MatchPrediction[];
}

function pct(v: number): string {
  return (v * 100).toFixed(0) + "%";
}

function MatchCard({ match }: { match: MatchPrediction }) {
  const maxProb = Math.max(match.homeWin, match.draw, match.awayWin);
  const homeWidth = Math.round(match.homeWin * 100);
  const drawWidth = Math.round(match.draw * 100);
  const awayWidth = 100 - homeWidth - drawWidth;

  return (
    <div className={cn(
      "rounded border overflow-hidden",
      match.isPlayoffTeam ? "border-amber-300 bg-amber-50/30" : "border-gray-200",
    )}>
      {/* Header: teams + xG */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex-1">
          <div className="font-semibold text-sm">{match.home}</div>
          <div className="text-xs text-gray-400">
            xG: <span className="font-mono font-semibold text-gray-600">{match.homeXg.toFixed(2)}</span>
          </div>
        </div>
        <div className="px-3 text-xs text-gray-400 font-semibold">vs</div>
        <div className="flex-1 text-right">
          <div className="font-semibold text-sm">{match.away}</div>
          <div className="text-xs text-gray-400">
            xG: <span className="font-mono font-semibold text-gray-600">{match.awayXg.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Win probability bar */}
      <div className="px-3 pb-1">
        <div className="flex h-6 rounded overflow-hidden text-[10px] font-bold">
          <div
            className="bg-[#1a2b4a] text-white flex items-center justify-center"
            style={{ width: `${homeWidth}%` }}
          >
            {homeWidth >= 15 && pct(match.homeWin)}
          </div>
          <div
            className="bg-gray-300 text-gray-700 flex items-center justify-center"
            style={{ width: `${drawWidth}%` }}
          >
            {drawWidth >= 15 && pct(match.draw)}
          </div>
          <div
            className="bg-[#40C28A] text-white flex items-center justify-center"
            style={{ width: `${awayWidth}%` }}
          >
            {awayWidth >= 15 && pct(match.awayWin)}
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
          <span>{match.home}</span>
          <span>Draw</span>
          <span>{match.away}</span>
        </div>
      </div>

      {/* Top scorelines */}
      <div className="px-3 pb-2">
        <div className="flex flex-wrap gap-1 mt-1">
          {match.topScorelines.map((s, i) => (
            <span
              key={i}
              className={cn(
                "inline-block px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums",
                i === 0 ? "bg-gray-200 font-bold" : "bg-gray-100 text-gray-500",
              )}
            >
              {s.home}-{s.away} <span className="text-gray-400">{(s.prob * 100).toFixed(0)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Playoff indicator */}
      {match.isPlayoffTeam && (
        <div className="px-3 pb-2">
          <span className="text-[9px] text-amber-600 font-medium">
            Playoff spot ({match.playoffPath})
          </span>
        </div>
      )}
    </div>
  );
}

export default function GroupMatchesPage() {
  const [activeGroup, setActiveGroup] = useState("A");
  const { data, isLoading } = useSWR<Record<string, GroupData>>(
    "/api/world-cup/group-matches",
    fetcher,
  );

  const groupData = data?.[activeGroup];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Group Matches</h2>
        <p className="text-sm text-gray-400">
          Predicted outcomes for every group stage match. Groups with playoff spots show all possible matchups.
        </p>
      </div>

      {/* Group tabs */}
      <div className="flex gap-0.5 border-b border-gray-200 overflow-x-auto">
        {GROUP_IDS.map(g => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={cn(
              "px-3 py-1.5 text-xs font-bold border-b-2 -mb-px transition-colors",
              activeGroup === g
                ? "border-[#1a2b4a] text-[#1a2b4a]"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            Group {g}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a2b4a]" />
        </div>
      ) : groupData ? (
        <div className="space-y-4">
          {/* Group info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Teams:</span>
            {groupData.teams.map(t => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold">{t}</span>
            ))}
            {groupData.playoffTeams && (
              <>
                <span className="text-xs text-amber-600">+ {groupData.playoffPath} winner:</span>
                {groupData.playoffTeams.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-amber-100 rounded text-xs font-semibold text-amber-800">{t}</span>
                ))}
              </>
            )}
          </div>

          {/* Confirmed matches */}
          {groupData.matches.filter(m => !m.isPlayoffTeam).length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">Confirmed Matchups</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groupData.matches
                  .filter(m => !m.isPlayoffTeam)
                  .map((m, i) => <MatchCard key={i} match={m} />)}
              </div>
            </div>
          )}

          {/* Playoff matchups */}
          {groupData.matches.filter(m => m.isPlayoffTeam).length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-1">Playoff Matchups</h3>
              <p className="text-xs text-gray-400 mb-2">
                These matches depend on which team wins the {groupData.playoffPath} playoff
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groupData.matches
                  .filter(m => m.isPlayoffTeam)
                  .map((m, i) => <MatchCard key={i} match={m} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-400">No data available.</p>
      )}
    </div>
  );
}
