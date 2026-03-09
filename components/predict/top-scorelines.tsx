"use client"

import { cn } from "@/lib/utils"

export interface Scoreline {
  homeGoals: number
  awayGoals: number
  probability: number
}

interface TopScorelinesProps {
  scorelines: Scoreline[]
  homeTeam: string
  awayTeam: string
}

export function TopScorelines({
  scorelines,
  homeTeam,
  awayTeam,
}: TopScorelinesProps) {
  const topScorelines = scorelines.slice(0, 10)
  const maxProb = Math.max(...topScorelines.map((s) => s.probability), 0)

  function getOutcomeColor(homeGoals: number, awayGoals: number): string {
    if (homeGoals > awayGoals) return "bg-[#1a2b4a]/10"
    if (homeGoals < awayGoals) return "bg-[#40C28A]/15"
    return "bg-gray-100"
  }

  function getBarColor(homeGoals: number, awayGoals: number): string {
    if (homeGoals > awayGoals) return "bg-[#1a2b4a]"
    if (homeGoals < awayGoals) return "bg-[#40C28A]"
    return "bg-gray-400"
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium text-gray-400">
        <span>Score ({homeTeam} - {awayTeam})</span>
        <span>Probability</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {topScorelines.map((scoreline, i) => {
          const pct = (scoreline.probability * 100).toFixed(1)
          const barWidth =
            maxProb > 0 ? (scoreline.probability / maxProb) * 100 : 0

          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex w-16 shrink-0 items-center justify-center rounded px-2 py-1 text-sm font-medium tabular-nums",
                  getOutcomeColor(scoreline.homeGoals, scoreline.awayGoals)
                )}
              >
                {scoreline.homeGoals} - {scoreline.awayGoals}
              </div>
              <div className="relative flex h-6 flex-1 items-center">
                <div
                  className={cn(
                    "h-full rounded transition-all duration-500",
                    getBarColor(scoreline.homeGoals, scoreline.awayGoals)
                  )}
                  style={{
                    width: `${barWidth}%`,
                    minWidth: barWidth > 0 ? "4px" : "0",
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-sm font-medium tabular-nums">
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
