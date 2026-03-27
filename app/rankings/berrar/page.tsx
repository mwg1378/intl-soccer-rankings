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
  berrarRating: number;
  berrarRank: number;
  currentOverallRating: number;
  currentRank: number;
  eloOffensive: number;
  eloDefensive: number;
}

const confederationColors: Record<string, string> = {
  UEFA: "text-blue-600",
  CONMEBOL: "text-green-600",
  CONCACAF: "text-yellow-600",
  CAF: "text-orange-600",
  AFC: "text-red-600",
  OFC: "text-teal-600",
};

export default function BerrarRankingsPage() {
  const [confederation, setConfederation] = useState<Confederation>("ALL");
  const router = useRouter();

  const params = new URLSearchParams({
    pageSize: "all",
    sortBy: "berrarRating",
    ...(confederation !== "ALL" && { confederation }),
  });

  const { data, isLoading } = useSWR(
    `/api/rankings?${params.toString()}`,
    fetcher
  );

  const teams: Team[] = data?.teams ?? [];
  const sorted = [...teams].sort((a, b) => b.berrarRating - a.berrarRating);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Berrar k-NN Rankings</h1>
        <p className="text-sm text-gray-400">
          Elo with k-nearest-neighbor adjustments for opponent strength (Berrar, 2017). Backtested: 58.8% accuracy, Brier=0.540.
        </p>
        <div className="flex gap-3 mt-1">
          <a href="/rankings" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Combined rankings &rarr;
          </a>
          <a href="/rankings/glicko" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Glicko-2 &rarr;
          </a>
          <a href="/rankings/op" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Ordered Probit &rarr;
          </a>
        </div>
      </div>

      <ConfederationFilter
        selected={confederation}
        onSelect={setConfederation}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#399F49]" />
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
                  <th className="text-right w-[80px]">Berrar</th>
                  <th className="text-right w-[80px] hidden md:table-cell">Elo</th>
                  <th className="text-right w-[80px] hidden md:table-cell">Combined</th>
                  <th className="text-right w-[50px] hidden lg:table-cell">Comb #</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((team, i) => {
                  const eloOverall = (team.eloOffensive + (3000 - team.eloDefensive)) / 2;
                  return (
                    <tr
                      key={team.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/team/${team.slug}`)}
                    >
                      <td>
                        <span className="font-semibold tabular-nums">{i + 1}</span>
                      </td>
                      <td>
                        <span className="font-medium">{team.name}</span>
                      </td>
                      <td>
                        <span className={cn("text-[11px] font-semibold", confederationColors[team.confederation])}>
                          {team.confederation}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono font-semibold tabular-nums">
                          {team.berrarRating.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-right hidden md:table-cell">
                        <span className="font-mono tabular-nums text-gray-400 text-xs">
                          {eloOverall.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-right hidden md:table-cell">
                        <span className="font-mono tabular-nums text-gray-400 text-xs">
                          {team.currentOverallRating.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-right hidden lg:table-cell">
                        <span className="tabular-nums text-gray-400 text-xs">
                          #{team.currentRank}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-center">
            {sorted.length} teams &middot; k-NN adjusts predictions based on performance vs similar-strength opponents
          </p>
        </>
      ) : (
        <p className="text-gray-400">No teams found.</p>
      )}
    </div>
  );
}
