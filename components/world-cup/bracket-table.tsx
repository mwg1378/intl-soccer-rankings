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

function probBg(v: number): string {
  if (v >= 0.4) return "bg-emerald-500/20";
  if (v >= 0.2) return "bg-emerald-500/10";
  if (v >= 0.1) return "bg-yellow-500/10";
  return "";
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
// e.g., match 73 (home="2A", away="2B") → { A: "2A", B: "2B" }
function buildPositionLabels(): Map<number, Map<string, string>> {
  const result = new Map<number, Map<string, string>>();
  for (const m of R32_MATCHES) {
    const labels = new Map<string, string>();
    // Home source: e.g. "2A" → group "A", position "2nd"
    const homeGroup = m.home.slice(1); // "A" from "2A"
    const homePos = m.home[0]; // "2" from "2A"
    labels.set(homeGroup, `${homePos === "1" ? "1st" : "2nd"} ${homeGroup}`);

    // Away source
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

  // Sort teams by probability descending, take top entries
  const sorted = Object.entries(data.teams)
    .sort((a, b) => b[1] - a[1])
    .filter(([, prob]) => prob >= 0.01);

  const has3rd = data.description.includes("3rd");

  const schedule = MATCH_SCHEDULE[Number(matchNum)];

  return (
    <div className={`rounded-lg border overflow-hidden ${has3rd ? "border-amber-500/30" : ""}`}>
      <div className={`px-3 py-1.5 ${
        has3rd ? "bg-amber-500/10" : "bg-muted/50"
      }`}>
        <div className={`text-xs font-semibold ${has3rd ? "text-amber-400" : ""}`}>
          Match {matchNum} — {data.description}
        </div>
        {schedule && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {schedule.date} &middot; {schedule.city}
          </div>
        )}
      </div>
      <div className="divide-y">
        {sorted.map(([slug, prob]) => {
          const info = slugInfo.get(slug);
          const posLabel = info && matchLabels ? matchLabels.get(info.group) : undefined;
          return (
            <div
              key={slug}
              className={`flex items-center justify-between px-3 py-1.5 text-sm ${probBg(prob)}`}
            >
              <span className="truncate">
                {info?.name ?? slug}
                {posLabel && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    ({posLabel})
                  </span>
                )}
              </span>
              <span className="font-mono text-xs ml-2 shrink-0">{pct(prob)}</span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground">No data</div>
        )}
      </div>
    </div>
  );
}

export function BracketTable({ bracketOdds, groupOdds }: BracketTableProps) {
  const slugInfo = buildSlugInfo(groupOdds);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Left Pathway</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Groups A, B, C, E, F, I → QF 97, 99 → SF 101
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
        <h3 className="text-lg font-semibold mb-3">Right Pathway</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Groups D, G, H, J, K, L → QF 98, 100 → SF 102
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
