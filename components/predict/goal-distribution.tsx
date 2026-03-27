"use client";

import { cn } from "@/lib/utils";

interface GoalDistributionProps {
  homeTeam: string;
  awayTeam: string;
  scoreMatrix: number[][]; // [homeGoals][awayGoals]
}

/**
 * Computes the marginal goal probability distribution for each team
 * from the full score matrix, and displays them as horizontal bar charts.
 */
export function GoalDistribution({ homeTeam, awayTeam, scoreMatrix }: GoalDistributionProps) {
  const maxGoals = Math.min(scoreMatrix.length, 7); // Show 0-6

  // Marginal distributions: sum across the other team's goals
  const homeDist: number[] = [];
  const awayDist: number[] = [];

  for (let g = 0; g < maxGoals; g++) {
    let homeP = 0;
    let awayP = 0;
    for (let other = 0; other < scoreMatrix.length; other++) {
      if (g < scoreMatrix.length && other < (scoreMatrix[g]?.length ?? 0)) {
        homeP += scoreMatrix[g][other]; // P(home = g)
      }
      if (other < scoreMatrix.length && g < (scoreMatrix[other]?.length ?? 0)) {
        awayP += scoreMatrix[other][g]; // P(away = g)
      }
    }
    homeDist.push(homeP);
    awayDist.push(awayP);
  }

  const maxProb = Math.max(...homeDist, ...awayDist);

  // Expected goals and over/under probabilities
  const homeXG = homeDist.reduce((s, p, g) => s + p * g, 0);
  const awayXG = awayDist.reduce((s, p, g) => s + p * g, 0);
  const totalXG = homeXG + awayXG;

  // P(total >= 2.5) — sum all cells where h+a >= 3
  let overTwoFive = 0;
  for (let h = 0; h < scoreMatrix.length; h++) {
    for (let a = 0; a < (scoreMatrix[h]?.length ?? 0); a++) {
      if (h + a >= 3) overTwoFive += scoreMatrix[h][a];
    }
  }

  // P(both teams score)
  let btts = 0;
  for (let h = 1; h < scoreMatrix.length; h++) {
    for (let a = 1; a < (scoreMatrix[h]?.length ?? 0); a++) {
      btts += scoreMatrix[h][a];
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Home team distribution */}
        <div>
          <div className="mb-2 text-sm font-medium">{homeTeam}</div>
          <div className="space-y-1">
            {homeDist.map((prob, goals) => (
              <GoalBar
                key={goals}
                goals={goals}
                prob={prob}
                maxProb={maxProb}
                color="bg-[#399F49]"
              />
            ))}
          </div>
        </div>

        {/* Away team distribution */}
        <div>
          <div className="mb-2 text-sm font-medium">{awayTeam}</div>
          <div className="space-y-1">
            {awayDist.map((prob, goals) => (
              <GoalBar
                key={goals}
                goals={goals}
                prob={prob}
                maxProb={maxProb}
                color="bg-[#399F49]"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex flex-wrap gap-3">
        <StatPill label="Total xG" value={totalXG.toFixed(2)} />
        <StatPill label="Over 2.5" value={`${(overTwoFive * 100).toFixed(0)}%`} />
        <StatPill label="Under 2.5" value={`${((1 - overTwoFive) * 100).toFixed(0)}%`} />
        <StatPill label="BTTS" value={`${(btts * 100).toFixed(0)}%`} />
      </div>
    </div>
  );
}

function GoalBar({
  goals,
  prob,
  maxProb,
  color,
}: {
  goals: number;
  prob: number;
  maxProb: number;
  color: string;
}) {
  const width = maxProb > 0 ? (prob / maxProb) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-right font-mono text-xs text-gray-400">{goals}</span>
      <div className="h-5 flex-1 overflow-hidden rounded bg-gray-50">
        <div
          className={cn("h-full rounded transition-all duration-300", color)}
          style={{ width: `${Math.max(width, 0.5)}%`, opacity: Math.max(0.2, prob / maxProb) }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs tabular-nums text-gray-600">
        {(prob * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 px-2.5 py-1">
      <span className="text-[10px] text-gray-400">{label} </span>
      <span className="font-mono text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}
