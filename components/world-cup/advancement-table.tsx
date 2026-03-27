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

function cellColor(v: number): string {
  if (v >= 0.8) return "text-green-700 font-semibold";
  if (v >= 0.5) return "text-green-600";
  if (v >= 0.3) return "text-gray-700";
  if (v >= 0.1) return "text-gray-500";
  return "text-gray-300";
}

export function AdvancementTable({ advancementOdds }: AdvancementTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("probChampion");
  const [showPlayoffs, setShowPlayoffs] = useState(false);

  const allTeams = Object.entries(advancementOdds);

  const confirmed = allTeams.filter(([, o]) => o.probQualify >= 0.999);
  const playoff = allTeams.filter(([, o]) => o.probQualify < 0.999 && o.probQualify > 0);

  const teamsToShow = showPlayoffs ? [...confirmed, ...playoff] : confirmed;

  const sorted = teamsToShow.sort((a, b) => {
    return b[1][sortKey] - a[1][sortKey];
  });

  const columns: Array<{ key: SortKey; label: string }> = [
    { key: "probR32", label: "R32" },
    { key: "probR16", label: "R16" },
    { key: "probQF", label: "QF" },
    { key: "probSF", label: "SF" },
    { key: "probFinal", label: "Final" },
    { key: "probChampion", label: "Champ" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setShowPlayoffs(!showPlayoffs)}
          className={`px-2.5 py-1 text-xs font-semibold rounded ${
            showPlayoffs ? "bg-[#399F49] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {showPlayoffs ? "Hide" : "Show"} Playoff Teams
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="tr-table">
          <thead>
            <tr>
              <th className="w-[40px]">#</th>
              <th>Team</th>
              <th className="text-center w-[40px]">Grp</th>
              {showPlayoffs && (
                <th className="text-right">Qual</th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-right cursor-pointer ${
                    sortKey === col.key ? "!text-[#399F49] underline" : ""
                  }`}
                  onClick={() => setSortKey(col.key)}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(([slug, odds], idx) => (
              <tr key={slug}>
                <td className="text-gray-400 font-mono">
                  {idx + 1}
                </td>
                <td className="font-medium">
                  {odds.name}
                  {odds.probQualify < 0.999 && (
                    <span className="ml-1 text-[10px] text-amber-500">*</span>
                  )}
                </td>
                <td className="text-center text-gray-400 text-xs">
                  {odds.group || "—"}
                </td>
                {showPlayoffs && (
                  <td className={`text-right font-mono ${
                    odds.probQualify < 0.999 ? "text-amber-600" : "text-gray-400"
                  }`}>
                    {odds.probQualify >= 0.999 ? "100%" : pct(odds.probQualify)}
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`text-right font-mono ${cellColor(odds[col.key])}`}
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
        <p className="text-xs text-gray-400">
          * {playoff.length} playoff teams hidden.{" "}
          <button
            onClick={() => setShowPlayoffs(true)}
            className="underline hover:text-gray-600"
          >
            Show all teams
          </button>
        </p>
      )}
    </div>
  );
}
