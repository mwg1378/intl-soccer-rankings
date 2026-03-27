"use client";

import { useState } from "react";

interface GroupOdds {
  group: string;
  name: string;
  probFirst: number;
  probSecond: number;
  probThird: number;
  probFourth: number;
  probAdvance: number;
  avgPoints: number;
  avgGD: number;
}

interface GroupStageTableProps {
  groupOdds: Record<string, GroupOdds>;
  playoffTeamsByGroup?: Record<string, string[]>;
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function probColor(v: number): string {
  if (v >= 0.5) return "text-green-700 font-semibold";
  if (v >= 0.3) return "text-green-600";
  if (v >= 0.15) return "text-gray-700";
  if (v >= 0.05) return "text-gray-400";
  return "text-gray-300";
}

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

export function GroupStageTable({ groupOdds, playoffTeamsByGroup = {} }: GroupStageTableProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Organize by group
  const byGroup = new Map<string, GroupOdds[]>();
  for (const odds of Object.values(groupOdds)) {
    const list = byGroup.get(odds.group) ?? [];
    list.push(odds);
    byGroup.set(odds.group, list);
  }

  // Sort each group by probFirst descending
  for (const [, teams] of byGroup) {
    teams.sort((a, b) => b.probFirst - a.probFirst);
  }

  const groupsToShow = selectedGroup ? [selectedGroup] : GROUPS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`px-2.5 py-1 text-xs font-semibold rounded ${
            !selectedGroup
              ? "bg-[#1a2b4a] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g === selectedGroup ? null : g)}
            className={`px-2.5 py-1 text-xs font-semibold rounded ${
              selectedGroup === g
                ? "bg-[#1a2b4a] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${selectedGroup ? "" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {groupsToShow.map((g) => {
          const teams = byGroup.get(g) ?? [];
          const playoffNames = new Set(playoffTeamsByGroup[g] ?? []);
          const confirmed = teams.filter((t) => !playoffNames.has(t.name));
          const qualifiers = teams.filter((t) => playoffNames.has(t.name));

          const TeamRow = ({ t }: { t: GroupOdds }) => (
            <tr key={t.name}>
              <td>{t.name}</td>
              <td className={`text-right font-mono ${probColor(t.probFirst)}`}>
                {pct(t.probFirst)}
              </td>
              <td className={`text-right font-mono ${probColor(t.probSecond)}`}>
                {pct(t.probSecond)}
              </td>
              <td className={`text-right font-mono ${probColor(t.probThird)}`}>
                {pct(t.probThird)}
              </td>
              <td className={`text-right font-mono ${probColor(t.probFourth)}`}>
                {pct(t.probFourth)}
              </td>
              <td className={`text-right font-mono font-semibold ${probColor(t.probAdvance)}`}>
                {pct(t.probAdvance)}
              </td>
              <td className="text-right font-mono text-gray-400">
                {t.avgPoints.toFixed(1)}
              </td>
            </tr>
          );

          return (
            <div key={g} className="overflow-x-auto rounded border border-gray-200">
              <table className="tr-table">
                <thead>
                  <tr>
                    <th colSpan={7} className="!text-[13px] !normal-case !tracking-normal">
                      Group {g}
                    </th>
                  </tr>
                  <tr>
                    <th>Team</th>
                    <th className="text-right">1st</th>
                    <th className="text-right">2nd</th>
                    <th className="text-right">3rd</th>
                    <th className="text-right">4th</th>
                    <th className="text-right">Adv.</th>
                    <th className="text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmed.map((t) => (
                    <TeamRow key={t.name} t={t} />
                  ))}
                  {qualifiers.length > 0 && (
                    <>
                      <tr className="separator-row">
                        <td colSpan={7} className="text-[11px] italic text-gray-400">
                          if they qualify
                        </td>
                      </tr>
                      {qualifiers.map((t) => (
                        <TeamRow key={t.name} t={t} />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
