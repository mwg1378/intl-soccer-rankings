"use client";

import { useState } from "react";
import { MATCH_SCHEDULE, R32_MATCHES } from "@/lib/world-cup-data";
import { cn } from "@/lib/utils";

interface KnockoutBracketProps {
  bracketOdds: Record<string, {
    description: string;
    teams: Record<string, number>;
  }>;
  groupOdds: Record<string, {
    group: string;
    name: string;
    probFirst: number;
    probSecond: number;
    probThird: number;
    probAdvance: number;
  }>;
}

type Round = "r32" | "r16" | "qf" | "sf" | "final";

const ROUNDS: { id: Round; label: string; matches: number[] }[] = [
  { id: "r32", label: "Round of 32", matches: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88] },
  { id: "r16", label: "Round of 16", matches: [89, 90, 91, 92, 93, 94, 95, 96] },
  { id: "qf", label: "Quarterfinals", matches: [97, 98, 99, 100] },
  { id: "sf", label: "Semifinals", matches: [101, 102] },
  { id: "final", label: "3rd Place & Final", matches: [103, 104] },
];

// Pathway labels for R32
const LEFT_R32 = [73, 74, 75, 76, 77, 78, 79, 80];
const RIGHT_R32 = [81, 82, 83, 84, 85, 86, 87, 88];

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

// Build slug → { name, group } map from groupOdds
function buildSlugInfo(groupOdds: KnockoutBracketProps["groupOdds"]): Map<string, { name: string; group: string }> {
  const map = new Map<string, { name: string; group: string }>();
  for (const [slug, data] of Object.entries(groupOdds)) {
    map.set(slug, { name: data.name, group: data.group });
  }
  return map;
}

function MatchSlot({
  matchNum,
  data,
  slugInfo,
}: {
  matchNum: number;
  data: { description: string; teams: Record<string, number> };
  slugInfo: Map<string, { name: string; group: string }>;
}) {
  const sorted = Object.entries(data.teams)
    .sort((a, b) => b[1] - a[1])
    .filter(([, prob]) => prob >= 0.005);

  const schedule = MATCH_SCHEDULE[matchNum];
  const has3rd = data.description.includes("3rd Place");
  const isFinal = matchNum === 104;
  const isThirdPlace = matchNum === 103;

  const headerBg = isFinal
    ? "bg-yellow-600"
    : isThirdPlace
    ? "bg-amber-700"
    : has3rd
    ? "bg-amber-50 border-b border-amber-200"
    : "bg-[#1a2b4a]";

  const headerText = has3rd && !isFinal && !isThirdPlace
    ? "text-amber-800"
    : "text-white";

  const subText = has3rd && !isFinal && !isThirdPlace
    ? "text-amber-600"
    : "text-white/60";

  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className={`px-3 py-2 ${headerBg}`}>
        <div className={`text-xs font-bold ${headerText}`}>
          M{matchNum} &mdash; {data.description}
        </div>
        {schedule && (
          <div className={`text-sm font-semibold mt-0.5 ${subText}`}>
            {schedule.date} &middot; {schedule.venue}, {schedule.city}
          </div>
        )}
      </div>
      <table className="tr-table">
        <tbody>
          {sorted.slice(0, 12).map(([slug, prob]) => {
            const info = slugInfo.get(slug);
            return (
              <tr key={slug}>
                <td>
                  {info?.name ?? slug}
                </td>
                <td className="text-right font-mono font-semibold tabular-nums">
                  {pct(prob)}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={2} className="text-gray-400">No data</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function KnockoutBracket({ bracketOdds, groupOdds }: KnockoutBracketProps) {
  const [activeRound, setActiveRound] = useState<Round>("r32");
  const slugInfo = buildSlugInfo(groupOdds);

  const currentRound = ROUNDS.find(r => r.id === activeRound)!;
  const matchNums = currentRound.matches;

  // For R32, split into pathways
  const isR32 = activeRound === "r32";
  const leftMatches = isR32 ? matchNums.filter(n => LEFT_R32.includes(n)) : [];
  const rightMatches = isR32 ? matchNums.filter(n => RIGHT_R32.includes(n)) : [];

  // Grid columns based on round
  const gridCols = activeRound === "r32" ? "md:grid-cols-2 xl:grid-cols-4"
    : activeRound === "r16" ? "md:grid-cols-2 xl:grid-cols-4"
    : activeRound === "qf" ? "md:grid-cols-2 xl:grid-cols-4"
    : activeRound === "sf" ? "md:grid-cols-2"
    : "md:grid-cols-2";

  return (
    <div className="space-y-4">
      {/* Round tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {ROUNDS.map(round => (
          <button
            key={round.id}
            onClick={() => setActiveRound(round.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeRound === round.id
                ? "border-[#1a2b4a] text-[#1a2b4a]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            {round.label}
          </button>
        ))}
      </div>

      {isR32 ? (
        <div className="space-y-8">
          <div>
            <h3 className="text-base font-bold mb-1">Left Pathway</h3>
            <p className="text-xs text-gray-400 mb-3">Groups A, B, C, E, F, I</p>
            <div className={`grid gap-3 ${gridCols}`}>
              {leftMatches.map(num => {
                const data = bracketOdds[String(num)];
                if (!data) return null;
                return <MatchSlot key={num} matchNum={num} data={data} slugInfo={slugInfo} />;
              })}
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold mb-1">Right Pathway</h3>
            <p className="text-xs text-gray-400 mb-3">Groups D, G, H, J, K, L</p>
            <div className={`grid gap-3 ${gridCols}`}>
              {rightMatches.map(num => {
                const data = bracketOdds[String(num)];
                if (!data) return null;
                return <MatchSlot key={num} matchNum={num} data={data} slugInfo={slugInfo} />;
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={`grid gap-3 ${gridCols}`}>
          {matchNums.map(num => {
            const data = bracketOdds[String(num)];
            if (!data) return null;
            return <MatchSlot key={num} matchNum={num} data={data} slugInfo={slugInfo} />;
          })}
        </div>
      )}
    </div>
  );
}
