"use client";

import { useState, useMemo, useCallback } from "react";
import {
  generateGroupMatches,
  computeStandings,
  completedMatchCount,
  type ScenarioMatch,
  type ScenarioStanding,
} from "@/lib/scenario-engine";
import { GROUPS, dbName } from "@/lib/world-cup-data";

const GROUP_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function resolveGroupTeams(groupId: string): string[] {
  const raw = GROUPS[groupId] ?? [];
  return raw.map((t) => (t.startsWith("__") ? "TBD" : dbName(t)));
}

function qualColor(q: ScenarioStanding["qualified"]): string {
  switch (q) {
    case "group_winner": return "bg-green-100 text-green-800";
    case "runner_up": return "bg-green-50 text-green-700";
    case "third_possible": return "bg-amber-50 text-amber-700";
    case "eliminated": return "bg-red-50 text-red-700";
  }
}

function qualLabel(q: ScenarioStanding["qualified"]): string {
  switch (q) {
    case "group_winner": return "1st";
    case "runner_up": return "2nd";
    case "third_possible": return "3rd*";
    case "eliminated": return "4th";
  }
}

interface MatchInputProps {
  match: ScenarioMatch;
  onChange: (home: number | null, away: number | null) => void;
}

function MatchInput({ match, onChange }: MatchInputProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-28 truncate text-right text-sm font-medium">
        {match.home}
      </span>
      <input
        type="number"
        min={0}
        max={20}
        value={match.homeGoals ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
          onChange(v, match.awayGoals);
        }}
        className="w-12 rounded border border-gray-300 px-2 py-1 text-center text-sm font-mono tabular-nums focus:border-[#1a2b4a] focus:outline-none focus:ring-1 focus:ring-[#1a2b4a]"
        placeholder="-"
      />
      <span className="text-xs text-gray-400">v</span>
      <input
        type="number"
        min={0}
        max={20}
        value={match.awayGoals ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
          onChange(match.homeGoals, v);
        }}
        className="w-12 rounded border border-gray-300 px-2 py-1 text-center text-sm font-mono tabular-nums focus:border-[#1a2b4a] focus:outline-none focus:ring-1 focus:ring-[#1a2b4a]"
        placeholder="-"
      />
      <span className="w-28 truncate text-sm font-medium">
        {match.away}
      </span>
    </div>
  );
}

function StandingsTable({ standings, completed }: { standings: ScenarioStanding[]; completed: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th className="py-2 text-left">#</th>
            <th className="py-2 text-left">Team</th>
            <th className="py-2 text-center">P</th>
            <th className="py-2 text-center">W</th>
            <th className="py-2 text-center">D</th>
            <th className="py-2 text-center">L</th>
            <th className="py-2 text-center">GF</th>
            <th className="py-2 text-center">GA</th>
            <th className="py-2 text-center">GD</th>
            <th className="py-2 text-center font-bold">Pts</th>
            {completed === 6 && <th className="py-2 text-center">Status</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.team} className="border-b border-gray-100">
              <td className="py-1.5 text-gray-400 font-mono">{s.position}</td>
              <td className="py-1.5 font-medium">{s.team}</td>
              <td className="py-1.5 text-center font-mono">{s.played}</td>
              <td className="py-1.5 text-center font-mono">{s.wins}</td>
              <td className="py-1.5 text-center font-mono">{s.draws}</td>
              <td className="py-1.5 text-center font-mono">{s.losses}</td>
              <td className="py-1.5 text-center font-mono">{s.gf}</td>
              <td className="py-1.5 text-center font-mono">{s.ga}</td>
              <td className="py-1.5 text-center font-mono font-medium">
                {s.gd > 0 ? `+${s.gd}` : s.gd}
              </td>
              <td className="py-1.5 text-center font-mono font-bold">{s.points}</td>
              {completed === 6 && (
                <td className="py-1.5 text-center">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${qualColor(s.qualified)}`}>
                    {qualLabel(s.qualified)}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScenarioSimulator() {
  const [selectedGroup, setSelectedGroup] = useState("A");

  const teams = useMemo(() => resolveGroupTeams(selectedGroup), [selectedGroup]);
  const initialMatches = useMemo(() => generateGroupMatches(teams), [teams]);
  const [matches, setMatches] = useState<ScenarioMatch[]>(initialMatches);

  // Reset matches when group changes
  const handleGroupChange = useCallback((g: string) => {
    setSelectedGroup(g);
    const newTeams = resolveGroupTeams(g);
    setMatches(generateGroupMatches(newTeams));
  }, []);

  const handleMatchChange = useCallback((idx: number, home: number | null, away: number | null) => {
    setMatches((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], homeGoals: home, awayGoals: away };
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setMatches(generateGroupMatches(teams));
  }, [teams]);

  const handleRandomize = useCallback(() => {
    setMatches((prev) =>
      prev.map((m) => ({
        ...m,
        homeGoals: Math.floor(Math.random() * 4),
        awayGoals: Math.floor(Math.random() * 4),
      }))
    );
  }, []);

  const standings = useMemo(() => computeStandings(teams, matches), [teams, matches]);
  const completed = completedMatchCount(matches);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What-If Scenario Builder</h2>
        <p className="text-sm text-gray-400">
          Set match scores manually to explore how different results affect group standings and qualification.
        </p>
      </div>

      {/* Group selector */}
      <div className="flex flex-wrap gap-1">
        {GROUP_IDS.map((g) => (
          <button
            key={g}
            onClick={() => handleGroupChange(g)}
            className={`px-2.5 py-1 text-xs font-semibold rounded ${
              selectedGroup === g
                ? "bg-[#1a2b4a] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Group {g}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Match inputs */}
        <div className="rounded border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Group {selectedGroup} Matches
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleRandomize}
                className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                Randomize
              </button>
              <button
                onClick={handleReset}
                className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {matches.map((m, idx) => (
              <MatchInput
                key={`${m.home}-${m.away}`}
                match={m}
                onChange={(h, a) => handleMatchChange(idx, h, a)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {completed}/6 matches set
            {completed < 6 && " — fill in all scores to see final standings"}
          </p>
        </div>

        {/* Live standings */}
        <div className="rounded border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">
            Group {selectedGroup} Standings
          </h3>
          {completed === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              Enter match scores to see standings
            </div>
          ) : (
            <>
              <StandingsTable standings={standings} completed={completed} />
              {completed === 6 && (
                <div className="mt-3 space-y-1 text-xs text-gray-400">
                  <p>
                    <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">1st</span>{" "}
                    <span className="inline-block rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">2nd</span>{" "}
                    Qualify automatically
                  </p>
                  <p>
                    <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">3rd*</span>{" "}
                    May qualify as one of the 8 best third-place teams
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
