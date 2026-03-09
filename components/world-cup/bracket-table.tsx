"use client";

import { MATCH_SCHEDULE, R32_MATCHES } from "@/lib/world-cup-data";

interface BracketTableProps {
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

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

// R32 match numbers in bracket order
const LEFT_PATHWAY = [73, 74, 75, 76, 77, 78, 79, 80];
const RIGHT_PATHWAY = [81, 82, 83, 84, 85, 86, 87, 88];

// Build slug → { name, group } map from groupOdds
function buildSlugInfo(groupOdds: BracketTableProps["groupOdds"]): Map<string, { name: string; group: string }> {
  const map = new Map<string, { name: string; group: string }>();
  for (const [slug, data] of Object.entries(groupOdds)) {
    map.set(slug, { name: data.name, group: data.group });
  }
  return map;
}

// Build a map: matchNum → { group → positionLabel }
function buildPositionLabels(): Map<number, Map<string, string>> {
  const result = new Map<number, Map<string, string>>();
  for (const m of R32_MATCHES) {
    const labels = new Map<string, string>();
    const homeGroup = m.home.slice(1);
    const homePos = m.home[0];
    labels.set(homeGroup, `${homePos === "1" ? "1st" : "2nd"} ${homeGroup}`);

    if (m.away === "3rd" && m.eligible3rd) {
      for (const g of m.eligible3rd) {
        labels.set(g, `3rd ${g}`);
      }
    } else if (m.away !== "3rd") {
      const awayGroup = m.away.slice(1);
      const awayPos = m.away[0];
      labels.set(awayGroup, `${awayPos === "1" ? "1st" : "2nd"} ${awayGroup}`);
    }

    result.set(m.num, labels);
  }
  return result;
}

const POSITION_LABELS = buildPositionLabels();

function MatchSlot({
  matchNum,
  data,
  slugInfo,
}: {
  matchNum: string;
  data: { description: string; teams: Record<string, number> };
  slugInfo: Map<string, { name: string; group: string }>;
}) {
  const matchLabels = POSITION_LABELS.get(Number(matchNum));

  const sorted = Object.entries(data.teams)
    .sort((a, b) => b[1] - a[1])
    .filter(([, prob]) => prob >= 0.01);

  const has3rd = data.description.includes("3rd");
  const schedule = MATCH_SCHEDULE[Number(matchNum)];

  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className={`px-3 py-1.5 ${has3rd ? "bg-amber-50 border-b border-amber-200" : "bg-[#1a2b4a]"}`}>
        <div className={`text-xs font-semibold ${has3rd ? "text-amber-800" : "text-white"}`}>
          M{matchNum} &mdash; {data.description}
        </div>
        {schedule && (
          <div className={`text-[10px] mt-0.5 ${has3rd ? "text-amber-600" : "text-white/60"}`}>
            {schedule.date} &middot; {schedule.city}
          </div>
        )}
      </div>
      <table className="tr-table">
        <tbody>
          {sorted.map(([slug, prob]) => {
            const info = slugInfo.get(slug);
            const posLabel = info && matchLabels ? matchLabels.get(info.group) : undefined;
            return (
              <tr key={slug}>
                <td>
                  {info?.name ?? slug}
                  {posLabel && (
                    <span className="ml-1 text-[10px] text-gray-400">
                      ({posLabel})
                    </span>
                  )}
                </td>
                <td className="text-right font-mono font-semibold">
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

export function BracketTable({ bracketOdds, groupOdds }: BracketTableProps) {
  const slugInfo = buildSlugInfo(groupOdds);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-bold mb-1">Left Pathway</h3>
        <p className="text-xs text-gray-400 mb-3">
          Groups A, B, C, E, F, I
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {LEFT_PATHWAY.map((num) => {
            const data = bracketOdds[String(num)];
            if (!data) return null;
            return (
              <MatchSlot
                key={num}
                matchNum={String(num)}
                data={data}
                slugInfo={slugInfo}
              />
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold mb-1">Right Pathway</h3>
        <p className="text-xs text-gray-400 mb-3">
          Groups D, G, H, J, K, L
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {RIGHT_PATHWAY.map((num) => {
            const data = bracketOdds[String(num)];
            if (!data) return null;
            return (
              <MatchSlot
                key={num}
                matchNum={String(num)}
                data={data}
                slugInfo={slugInfo}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
