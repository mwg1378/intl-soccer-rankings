"use client";

import { useState } from "react";

interface AdvancementOdds {
  name: string;
  group: string;
  probQualify: number;
  probGroupStage: number;
  probR32: number;
  probR16: number;
  probQF: number;
  probSF: number;
  probFinal: number;
  probChampion: number;
}

interface AdvancementTableProps {
  advancementOdds: Record<string, AdvancementOdds>;
}

type SortKey = "probR32" | "probR16" | "probQF" | "probSF" | "probFinal" | "probChampion";

function pct(v: number): string {
  if (v === 0) return "—";
  if (v < 0.001) return "<0.1%";
  return (v * 100).toFixed(1) + "%";
}

function cellBg(v: number): string {
  if (v >= 0.8) return "bg-emerald-500/25 text-emerald-300";
  if (v >= 0.5) return "bg-emerald-500/15 text-emerald-400";
  if (v >= 0.3) return "bg-emerald-500/10";
  if (v >= 0.1) return "bg-yellow-500/5";
  return "text-muted-foreground";
}

export function AdvancementTable({ advancementOdds }: AdvancementTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("probChampion");
  const [showPlayoffs, setShowPlayoffs] = useState(false);

  const allTeams = Object.entries(advancementOdds);

  // Separate confirmed teams (probQualify == 1.0) and playoff teams
  const confirmed = allTeams.filter(([, o]) => o.probQualify >= 0.999);
  const playoff = allTeams.filter(([, o]) => o.probQualify < 0.999 && o.probQualify > 0);

  const teamsToShow = showPlayoffs ? [...confirmed, ...playoff] : confirmed;

  const sorted = teamsToShow.sort((a, b) => {
    const aVal = a[1][sortKey];
    const bVal = b[1][sortKey];
    return bVal - aVal;
  });

  const columns: Array<{ key: SortKey; label: string; shortLabel: string }> = [
    { key: "probR32", label: "Round of 32", shortLabel: "R32" },
    { key: "probR16", label: "Round of 16", shortLabel: "R16" },
    { key: "probQF", label: "Quarterfinals", shortLabel: "QF" },
    { key: "probSF", label: "Semifinals", shortLabel: "SF" },
    { key: "probFinal", label: "Final", shortLabel: "Final" },
    { key: "probChampion", label: "Champion", shortLabel: "Champ" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setShowPlayoffs(!showPlayoffs)}
          className={`px-3 py-1 text-sm rounded-md ${
            showPlayoffs ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
          }`}
        >
          {showPlayoffs ? "Hide" : "Show"} Playoff Teams
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2 font-medium sticky left-0 bg-muted/50">#</th>
              <th className="text-left px-4 py-2 font-medium sticky left-8 bg-muted/50">Team</th>
              <th className="text-center px-2 py-2 font-medium">Grp</th>
              {showPlayoffs && (
                <th className="text-right px-2 py-2 font-medium">Qualify</th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-right px-2 py-2 font-medium cursor-pointer hover:text-foreground ${
                    sortKey === col.key ? "text-foreground underline" : "text-muted-foreground"
                  }`}
                  onClick={() => setSortKey(col.key)}
                >
                  {col.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(([slug, odds], idx) => (
              <tr key={slug} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground font-mono text-xs sticky left-0 bg-background">
                  {idx + 1}
                </td>
                <td className="px-4 py-2 font-medium whitespace-nowrap sticky left-8 bg-background">
                  {odds.name}
                  {odds.probQualify < 0.999 && (
                    <span className="ml-1 text-xs text-amber-400">*</span>
                  )}
                </td>
                <td className="text-center px-2 py-2 text-muted-foreground text-xs">
                  {odds.group || "—"}
                </td>
                {showPlayoffs && (
                  <td className={`text-right px-2 py-2 font-mono text-xs ${
                    odds.probQualify < 0.999 ? "text-amber-400" : "text-muted-foreground"
                  }`}>
                    {odds.probQualify >= 0.999 ? "100%" : pct(odds.probQualify)}
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`text-right px-2 py-2 font-mono text-xs ${cellBg(odds[col.key])}`}
                  >
                    {pct(odds[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showPlayoffs && playoff.length > 0 && (
        <p className="text-xs text-muted-foreground">
          * {playoff.length} playoff teams hidden.{" "}
          <button
            onClick={() => setShowPlayoffs(true)}
            className="underline hover:text-foreground"
          >
            Show all teams
          </button>
        </p>
      )}
    </div>
  );
}
