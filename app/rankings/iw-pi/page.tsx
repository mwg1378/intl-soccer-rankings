"use client";

import { useState } from "react";
import {
  ConfederationFilter,
  type Confederation,
} from "@/components/rankings/confederation-filter";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Team {
  id: string;
  name: string;
  slug: string;
  fifaCode: string;
  confederation: string;
  iwPiHome: number;
  iwPiAway: number;
  iwPiOverall: number;
  iwPiRank: number;
  piOverall: number;
  currentRank: number;
}

const confederationColors: Record<string, string> = {
  UEFA: "text-blue-600",
  CONMEBOL: "text-green-600",
  CONCACAF: "text-yellow-600",
  CAF: "text-orange-600",
  AFC: "text-red-600",
  OFC: "text-teal-600",
};

export default function IwPiRankingsPage() {
  const [confederation, setConfederation] = useState<Confederation>("ALL");
  const router = useRouter();

  const params = new URLSearchParams({
    pageSize: "all",
    sortBy: "iwPiOverall",
    ...(confederation !== "ALL" && { confederation }),
  });

  const { data, isLoading } = useSWR(
    `/api/rankings?${params.toString()}`,
    fetcher
  );

  const teams: Team[] = data?.teams ?? [];
  const sorted = [...teams].sort((a, b) => b.iwPiOverall - a.iwPiOverall);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Importance-Weighted Pi-Ratings</h1>
        <p className="text-sm text-gray-400">
          Pi-ratings scaled by match importance &mdash; World Cup matches weigh 3x more than friendlies. #1 composite in backtesting (Brier=0.536, MarginMAE=1.26).
        </p>
        <div className="flex gap-3 mt-1">
          <a href="/rankings/compare" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Compare all models &rarr;
          </a>
          <a href="/rankings/pi" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Standard Pi-ratings &rarr;
          </a>
        </div>
      </div>

      <ConfederationFilter selected={confederation} onSelect={setConfederation} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a2b4a]" />
        </div>
      ) : sorted.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="tr-table">
              <thead>
                <tr>
                  <th className="w-[50px]">Rank</th>
                  <th>Team</th>
                  <th className="w-[70px]">Conf</th>
                  <th className="text-right w-[70px]">Overall</th>
                  <th className="text-right w-[70px]">Home</th>
                  <th className="text-right w-[70px]">Away</th>
                  <th className="text-right w-[60px] hidden md:table-cell">Split</th>
                  <th className="text-right w-[70px] hidden md:table-cell">Std Pi</th>
                  <th className="text-right w-[50px] hidden lg:table-cell">Comb #</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((team, i) => {
                  const split = team.iwPiHome - team.iwPiAway;
                  return (
                    <tr key={team.id} className="cursor-pointer" onClick={() => router.push(`/team/${team.slug}`)}>
                      <td><span className="font-semibold tabular-nums">{i + 1}</span></td>
                      <td><span className="font-medium">{team.name}</span></td>
                      <td>
                        <span className={cn("text-[11px] font-semibold", confederationColors[team.confederation])}>
                          {team.confederation}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono font-semibold tabular-nums">{team.iwPiOverall.toFixed(2)}</span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono tabular-nums text-gray-500">{team.iwPiHome.toFixed(2)}</span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono tabular-nums text-gray-500">{team.iwPiAway.toFixed(2)}</span>
                      </td>
                      <td className="text-right hidden md:table-cell">
                        <span className={cn(
                          "font-mono tabular-nums text-xs",
                          split > 0.3 ? "text-green-600" : split < -0.1 ? "text-red-600" : "text-gray-400"
                        )}>
                          {split > 0 ? "+" : ""}{split.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-right hidden md:table-cell">
                        <span className="font-mono tabular-nums text-gray-400 text-xs">{team.piOverall.toFixed(2)}</span>
                      </td>
                      <td className="text-right hidden lg:table-cell">
                        <span className="tabular-nums text-gray-400 text-xs">#{team.currentRank}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-center">
            {sorted.length} teams &middot; Split = Home - Away (green = strong home advantage)
          </p>
        </>
      ) : (
        <p className="text-gray-400">No teams found.</p>
      )}
    </div>
  );
}
