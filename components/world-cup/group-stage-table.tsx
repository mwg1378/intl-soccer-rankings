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

function probBg(v: number): string {
  if (v >= 0.5) return "bg-emerald-500/20 text-emerald-400";
  if (v >= 0.3) return "bg-emerald-500/10 text-emerald-300";
  if (v >= 0.15) return "bg-yellow-500/10 text-yellow-400";
  if (v >= 0.05) return "bg-orange-500/10 text-orange-400";
  return "text-muted-foreground";
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
          className={`px-3 py-1 text-sm rounded-md ${
            !selectedGroup
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          All
        </button>
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g === selectedGroup ? null : g)}
            className={`px-3 py-1 text-sm rounded-md ${
              selectedGroup === g
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-muted/80"
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
            <tr key={t.name} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium whitespace-nowrap">{t.name}</td>
              <td className={`text-right px-2 py-2 font-mono text-xs ${probBg(t.probFirst)}`}>
                {pct(t.probFirst)}
              </td>
              <td className={`text-right px-2 py-2 font-mono text-xs ${probBg(t.probSecond)}`}>
                {pct(t.probSecond)}
              </td>
              <td className={`text-right px-2 py-2 font-mono text-xs ${probBg(t.probThird)}`}>
                {pct(t.probThird)}
              </td>
              <td className={`text-right px-2 py-2 font-mono text-xs ${probBg(t.probFourth)}`}>
                {pct(t.probFourth)}
              </td>
              <td className={`text-right px-2 py-2 font-mono text-xs font-bold ${probBg(t.probAdvance)}`}>
                {pct(t.probAdvance)}
              </td>
              <td className="text-right px-2 py-2 font-mono text-xs text-muted-foreground">
                {t.avgPoints.toFixed(1)}
              </td>
            </tr>
          );

          return (
            <div key={g} className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 font-semibold text-sm">
                Group {g}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Team</th>
                      <th className="text-right px-2 py-2 font-medium">1st</th>
                      <th className="text-right px-2 py-2 font-medium">2nd</th>
                      <th className="text-right px-2 py-2 font-medium">3rd</th>
                      <th className="text-right px-2 py-2 font-medium">4th</th>
                      <th className="text-right px-2 py-2 font-medium">Adv.</th>
                      <th className="text-right px-2 py-2 font-medium">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmed.map((t) => (
                      <TeamRow key={t.name} t={t} />
                    ))}
                    {qualifiers.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-1 text-[11px] italic text-muted-foreground border-t border-dashed"
                          >
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
