"use client"

import { cn } from "@/lib/utils"

interface ProbabilityBarProps {
  homeTeam: string
  awayTeam: string
  homeWinProb: number
  drawProb: number
  awayWinProb: number
}

export function ProbabilityBar({
  homeTeam,
  awayTeam,
  homeWinProb,
  drawProb,
  awayWinProb,
}: ProbabilityBarProps) {
  const homePct = Math.round(homeWinProb * 100)
  const drawPct = Math.round(drawProb * 100)
  const awayPct = Math.round(awayWinProb * 100)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{homeTeam}</span>
        <span>{awayTeam}</span>
      </div>
      <div className="flex h-10 w-full overflow-hidden rounded text-sm font-medium">
        {homePct > 0 && (
          <div
            className={cn(
              "flex items-center justify-center bg-[#1a2b4a] text-white transition-all duration-500",
              homePct < 10 && "text-xs"
            )}
            style={{ width: `${homePct}%` }}
          >
            {homePct >= 5 && `${homePct}%`}
          </div>
        )}
        {drawPct > 0 && (
          <div
            className={cn(
              "flex items-center justify-center bg-gray-300 text-gray-700 transition-all duration-500",
              drawPct < 10 && "text-xs"
            )}
            style={{ width: `${drawPct}%` }}
          >
            {drawPct >= 5 && `${drawPct}%`}
          </div>
        )}
        {awayPct > 0 && (
          <div
            className={cn(
              "flex items-center justify-center bg-[#40C28A] text-white transition-all duration-500",
              awayPct < 10 && "text-xs"
            )}
            style={{ width: `${awayPct}%` }}
          >
            {awayPct >= 5 && `${awayPct}%`}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Home Win</span>
        <span>Draw</span>
        <span>Away Win</span>
      </div>
    </div>
  )
}
