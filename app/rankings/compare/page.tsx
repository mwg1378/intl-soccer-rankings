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
  currentRank: number;
  currentOverallRating: number;
  eloOffensive: number;
  eloDefensive: number;
  btRating: number;
  btRank: number;
  piOverall: number;
  glickoRating: number;
  glickoRank: number;
  berrarRating: number;
  berrarRank: number;
  opRating: number;
  opRank: number;
  iwPiOverall: number;
  iwPiRank: number;
  moEloOffensive: number;
  moEloDefensive: number;
  moEloRank: number;
  gridOptOff: number;
  gridOptDef: number;
  gridOptRank: number;
  top3Off: number;
  top3Def: number;
  top3Rank: number;
  btMktOff: number;
  btMktDef: number;
  btMktRank: number;
}

type SortKey =
  | "combined"
  | "elo"
  | "bt"
  | "pi"
  | "glicko"
  | "berrar"
  | "op"
  | "iwPi"
  | "moElo"
  | "gridOpt"
  | "top3"
  | "btMkt";

const MODEL_INFO: Record<SortKey, { label: string; href: string; brier: string; acc: string }> = {
  combined: { label: "Combined", href: "/rankings", brier: "—", acc: "—" },
  elo: { label: "Elo", href: "/rankings/elo", brier: "0.552", acc: "58.0%" },
  bt: { label: "Bradley-Terry", href: "/rankings/bt", brier: "—", acc: "—" },
  pi: { label: "Pi-Ratings", href: "/rankings/pi", brier: "—", acc: "—" },
  iwPi: { label: "IW Pi-Ratings", href: "/rankings/iw-pi", brier: "0.536", acc: "57.6%" },
  glicko: { label: "Glicko-2", href: "/rankings/glicko", brier: "0.541", acc: "59.3%" },
  berrar: { label: "Berrar k-NN", href: "/rankings/berrar", brier: "0.540", acc: "58.8%" },
  op: { label: "Ordered Probit", href: "/rankings/op", brier: "0.555", acc: "56.8%" },
  moElo: { label: "Margin-Opt Elo", href: "/rankings/mo-elo", brier: "0.548", acc: "57.2%" },
  gridOpt: { label: "Grid-Opt*", href: "/rankings/compare", brier: "MSE .00027", acc: "r=.91" },
  top3: { label: "Top-3 Equal*", href: "/rankings/compare", brier: "MSE .00044", acc: "r=.88" },
  btMkt: { label: "BT+Market*", href: "/rankings/compare", brier: "MSE .00048", acc: "r=.81" },
};

const confederationColors: Record<string, string> = {
  UEFA: "text-blue-600",
  CONMEBOL: "text-green-600",
  CONCACAF: "text-yellow-600",
  CAF: "text-orange-600",
  AFC: "text-red-600",
  OFC: "text-teal-600",
};


function getRating(team: Team, key: SortKey): number {
  switch (key) {
    case "combined": return team.currentOverallRating;
    case "elo": return (team.eloOffensive + (3000 - team.eloDefensive)) / 2;
    case "bt": return team.btRating;
    case "pi": return team.piOverall;
    case "glicko": return team.glickoRating;
    case "berrar": return team.berrarRating;
    case "op": return team.opRating;
    case "iwPi": return team.iwPiOverall;
    case "moElo": return (team.moEloOffensive + (3000 - team.moEloDefensive)) / 2;
    case "gridOpt": return (team.gridOptOff + (3000 - team.gridOptDef)) / 2;
    case "top3": return (team.top3Off + (3000 - team.top3Def)) / 2;
    case "btMkt": return (team.btMktOff + (3000 - team.btMktDef)) / 2;
  }
}

export default function CompareRankingsPage() {
  const [confederation, setConfederation] = useState<Confederation>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("combined");
  const router = useRouter();

  const params = new URLSearchParams({
    pageSize: "all",
    ...(confederation !== "ALL" && { confederation }),
  });

  const { data, isLoading } = useSWR(`/api/rankings?${params.toString()}`, fetcher);

  const teams: Team[] = data?.teams ?? [];
  const sorted = [...teams].sort((a, b) => {
    const ra = getRating(a, sortBy);
    const rb = getRating(b, sortBy);
    return rb - ra;
  });

  const sortKeys: SortKey[] = ["gridOpt", "top3", "btMkt", "combined", "elo", "bt", "pi", "iwPi", "glicko", "berrar", "op", "moElo"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Rankings Comparison</h1>
        <p className="text-sm text-gray-400">
          Side-by-side comparison of all ranking models. Click a column header to sort.
          Backtested models show Brier score and accuracy from 2,083 tournament matches (2013-2024).
        </p>
      </div>

      <ConfederationFilter selected={confederation} onSelect={setConfederation} />

      {/* Model stats legend */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
        {sortKeys.filter(k => MODEL_INFO[k].brier !== "—").map(k => (
          <a key={k} href={MODEL_INFO[k].href}
            className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50">
            <div className="font-semibold">{MODEL_INFO[k].label}</div>
            <div className="text-gray-400">Brier: {MODEL_INFO[k].brier} &middot; Acc: {MODEL_INFO[k].acc}</div>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 -mt-3">
        Brier score: lower is better (random guessing = 0.667). Composites (*) are evaluated by market alignment (MSE and Spearman r), not Brier.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a2b4a]" />
        </div>
      ) : sorted.length > 0 ? (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="tr-table">
            <thead>
              <tr>
                <th className="w-[40px]">#</th>
                <th>Team</th>
                <th className="w-[50px]">Conf</th>
                {sortKeys.map(k => (
                  <th
                    key={k}
                    className={cn(
                      "text-right w-[60px] cursor-pointer hover:bg-gray-100 select-none",
                      sortBy === k && "bg-gray-100 font-bold"
                    )}
                    onClick={() => setSortBy(k)}
                  >
                    {MODEL_INFO[k].label.split(" ")[0]}
                    {sortBy === k && " \u25BC"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 100).map((team, i) => (
                <tr key={team.id} className="cursor-pointer" onClick={() => router.push(`/team/${team.slug}`)}>
                  <td><span className="font-semibold tabular-nums text-xs">{i + 1}</span></td>
                  <td><span className="font-medium text-sm">{team.name}</span></td>
                  <td>
                    <span className={cn("text-[10px] font-semibold", confederationColors[team.confederation])}>
                      {team.confederation}
                    </span>
                  </td>
                  {sortKeys.map(k => {
                    const rating = getRating(team, k);
                    // For pi-based models, show decimal; for Elo-based, show integer
                    const display = k === "pi" || k === "iwPi"
                      ? rating.toFixed(2)
                      : rating.toFixed(1);
                    return (
                      <td key={k} className={cn("text-right", sortBy === k && "bg-gray-50")}>
                        <span className={cn(
                          "font-mono tabular-nums text-xs",
                          sortBy === k ? "font-semibold" : "text-gray-500"
                        )}>
                          {display}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-400">No teams found.</p>
      )}

      {!isLoading && sorted.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Top 100 teams shown &middot; Click column headers to re-sort
        </p>
      )}
    </div>
  );
}
