"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface Player {
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
}

interface RosterTableProps {
  players: Player[];
}

type SortField = "position" | "compositeRating" | "marketValue";
type SortDir = "asc" | "desc";

const positionOrder: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

const positionColors: Record<string, string> = {
  GK: "bg-yellow-500/15 text-yellow-700",
  DEF: "bg-blue-500/15 text-blue-700",
  MID: "bg-green-500/15 text-green-700",
  FWD: "bg-red-500/15 text-red-700",
};

function formatMarketValue(value: number | null): string {
  if (value == null) return "\u2014";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `\u20AC${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `\u20AC${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }
  return `\u20AC${value}`;
}

export function RosterTable({ players }: RosterTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "position" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...players];
    if (!sortField) return copy;

    copy.sort((a, b) => {
      let cmp: number;
      if (sortField === "position") {
        cmp = (positionOrder[a.position] ?? 99) - (positionOrder[b.position] ?? 99);
      } else {
        cmp = ((a[sortField] as number) ?? 0) - ((b[sortField] as number) ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [players, sortField, sortDir]);

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="tr-table">
        <thead>
          <tr>
            <th
              className="cursor-pointer select-none"
              onClick={() => handleSort("position")}
            >
              Pos{sortIndicator("position")}
            </th>
            <th>Name</th>
            <th className="hidden md:table-cell">Detailed Pos</th>
            <th className="hidden lg:table-cell">Club</th>
            <th className="hidden lg:table-cell">League</th>
            <th
              className="cursor-pointer select-none text-right"
              onClick={() => handleSort("compositeRating")}
            >
              Rating{sortIndicator("compositeRating")}
            </th>
            <th
              className="cursor-pointer select-none text-right"
              onClick={() => handleSort("marketValue")}
            >
              Value{sortIndicator("marketValue")}
            </th>
            <th className="hidden sm:table-cell text-right">Caps</th>
            <th className="hidden sm:table-cell text-right">Goals</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((player) => (
            <tr key={player.id}>
              <td>
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold",
                    positionColors[player.position] ?? "bg-gray-100 text-gray-500"
                  )}
                >
                  {player.position}
                </span>
              </td>
              <td className="font-medium">
                <span className="flex items-center gap-2">
                  {player.name}
                  {player.isStartingXI && (
                    <span className="rounded bg-[#399F49] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                      XI
                    </span>
                  )}
                </span>
              </td>
              <td className="hidden md:table-cell text-gray-400">
                {player.detailedPosition}
              </td>
              <td className="hidden lg:table-cell">
                {player.currentClub}
              </td>
              <td className="hidden lg:table-cell text-gray-400">
                {player.currentLeague}
              </td>
              <td className="text-right tabular-nums font-medium font-mono">
                {player.compositeRating?.toFixed(1) ?? "\u2014"}
              </td>
              <td className="text-right tabular-nums font-mono">
                {formatMarketValue(player.marketValue)}
              </td>
              <td className="hidden sm:table-cell text-right tabular-nums font-mono">
                {player.caps}
              </td>
              <td className="hidden sm:table-cell text-right tabular-nums font-mono">
                {player.internationalGoals}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
