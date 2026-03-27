"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface PowerTeam {
  name: string;
  slug: string;
  group: string;
  confederation: string;
  overallRating: number;
  offensiveRating: number;
  defensiveRating: number;
  champProb: number;      // from simulation
  marketProb: number;     // from sportsbook consensus
  rank: number;
}

interface PowerRankingsProps {
  teams: PowerTeam[];
  ratingRange: { min: number; max: number };
}

type SortKey = "overallRating" | "champProb" | "marketProb" | "offensiveRating" | "defensiveRating";

const CONFED_COLORS: Record<string, string> = {
  UEFA: "bg-blue-100 text-blue-700",
  CONMEBOL: "bg-yellow-100 text-yellow-800",
  CONCACAF: "bg-green-100 text-green-700",
  CAF: "bg-orange-100 text-orange-700",
  AFC: "bg-red-100 text-red-700",
  OFC: "bg-purple-100 text-purple-700",
};

function pct(v: number): string {
  if (v === 0) return "—";
  if (v < 0.001) return "<0.1%";
  return (v * 100).toFixed(1) + "%";
}

function tier(rating: number, max: number, min: number): { label: string; color: string } {
  const range = max - min;
  const normalized = (rating - min) / range;
  if (normalized >= 0.85) return { label: "Elite", color: "text-yellow-600" };
  if (normalized >= 0.70) return { label: "Contender", color: "text-green-600" };
  if (normalized >= 0.50) return { label: "Competitive", color: "text-blue-600" };
  if (normalized >= 0.30) return { label: "Developing", color: "text-gray-600" };
  return { label: "Underdog", color: "text-gray-400" };
}

function StrengthBar({
  value,
  max,
  min,
  color,
}: {
  value: number;
  max: number;
  min: number;
  color: string;
}) {
  const pctWidth = Math.max(2, ((value - min) / (max - min)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${pctWidth}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs tabular-nums">
        {Math.round(value)}
      </span>
    </div>
  );
}

export function PowerRankings({ teams, ratingRange }: PowerRankingsProps) {
  const [sortKey, setSortKey] = useState<SortKey>("overallRating");
  const [confedFilter, setConfedFilter] = useState<string | null>(null);

  // Compute per-dimension ranges for accurate bar scaling
  const offRange = {
    min: Math.min(...teams.map((t) => t.offensiveRating)),
    max: Math.max(...teams.map((t) => t.offensiveRating)),
  };
  const defRange = {
    // Defense is inverted: 3000-rating, so compute range on inverted values
    min: Math.min(...teams.map((t) => 3000 - t.defensiveRating)),
    max: Math.max(...teams.map((t) => 3000 - t.defensiveRating)),
  };

  const filtered = confedFilter
    ? teams.filter((t) => t.confederation === confedFilter)
    : teams;

  const sorted = [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);

  const confeds = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">World Cup Power Rankings</h2>
        <p className="text-sm text-gray-400">
          All 48 teams ranked by composite strength with attack/defense breakdown.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setConfedFilter(null)}
            className={`px-2.5 py-1 text-xs font-semibold rounded ${
              !confedFilter
                ? "bg-[#399F49] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {confeds.map((c) => (
            <button
              key={c}
              onClick={() => setConfedFilter(c === confedFilter ? null : c)}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                confedFilter === c
                  ? "bg-[#399F49] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap gap-1">
        <span className="self-center text-xs text-gray-400 mr-1">Sort by:</span>
        {([
          ["overallRating", "Overall"],
          ["offensiveRating", "Attack"],
          ["defensiveRating", "Defense"],
          ["champProb", "Win %"],
          ["marketProb", "Market %"],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`px-2 py-1 text-xs rounded ${
              sortKey === key
                ? "bg-[#399F49] text-white"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Team cards */}
      <div className="space-y-2">
        {sorted.map((team, idx) => {
          const t = tier(team.overallRating, ratingRange.max, ratingRange.min);
          const edge = team.champProb - team.marketProb;

          return (
            <div
              key={team.slug}
              className="rounded border border-gray-200 p-3 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Rank */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-100 font-mono text-sm font-bold text-gray-600">
                  {idx + 1}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/team/${team.slug}`}
                      className="font-semibold text-sm hover:text-[#399F49] hover:underline"
                    >
                      {team.name}
                    </Link>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFED_COLORS[team.confederation] ?? "bg-gray-100 text-gray-600"}`}>
                      {team.confederation}
                    </span>
                    <span className="text-xs text-gray-400">Group {team.group}</span>
                    <span className={`text-[10px] font-semibold ${t.color}`}>
                      {t.label}
                    </span>
                  </div>

                  {/* Strength bars — longer = stronger */}
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Overall</div>
                      <StrengthBar
                        value={team.overallRating}
                        max={ratingRange.max}
                        min={ratingRange.min}
                        color="bg-[#399F49]"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Attack</div>
                      <StrengthBar
                        value={team.offensiveRating}
                        max={offRange.max}
                        min={offRange.min}
                        color="bg-[#399F49]"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5" title="Goals prevented — longer bar = fewer goals conceded">Defense</div>
                      <StrengthBar
                        value={3000 - team.defensiveRating}
                        max={defRange.max}
                        min={defRange.min}
                        color="bg-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Championship odds */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-gray-400">Win WC</div>
                  <div className="font-mono text-sm font-bold tabular-nums">
                    {pct(team.champProb)}
                  </div>
                  {team.marketProb > 0 && Math.abs(edge) > 0.005 && (
                    <div className={cn(
                      "text-[10px] font-medium",
                      edge > 0.01 ? "text-green-600" : edge < -0.01 ? "text-red-500" : "text-gray-400"
                    )}>
                      {edge > 0 ? "+" : ""}{(edge * 100).toFixed(1)}pp vs mkt
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
