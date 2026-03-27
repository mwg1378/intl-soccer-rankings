"use client"

import { cn } from "@/lib/utils"

interface ScoreMatrixProps {
  matrix: number[][]
  homeTeam: string
  awayTeam: string
}

export function ScoreMatrix({ matrix, homeTeam, awayTeam }: ScoreMatrixProps) {
  const maxProb = Math.max(...matrix.flat())

  function getCellColor(prob: number): string {
    if (maxProb === 0) return ""
    const intensity = prob / maxProb
    if (intensity > 0.8) return "bg-[#399F49] text-white"
    if (intensity > 0.6) return "bg-[#399F49]/70 text-white"
    if (intensity > 0.4) return "bg-[#399F49]/50 text-white"
    if (intensity > 0.2) return "bg-[#399F49]/30"
    if (intensity > 0.05) return "bg-[#399F49]/15"
    return "bg-gray-50 text-gray-300"
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center text-xs font-medium text-gray-400">
        {awayTeam} Goals &rarr;
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-gray-400" />
              {Array.from({ length: Math.min(matrix[0]?.length ?? 6, 6) }, (_, i) => (
                <th key={i} className="p-1.5 font-medium text-gray-400">
                  {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.slice(0, 6).map((row, homeGoals) => (
              <tr key={homeGoals}>
                <td className="p-1.5 font-medium text-gray-400">
                  {homeGoals}
                </td>
                {row.slice(0, 6).map((prob, awayGoals) => {
                  const pct = (prob * 100).toFixed(1)
                  return (
                    <td
                      key={awayGoals}
                      className={cn(
                        "rounded p-1.5 font-mono tabular-nums transition-colors",
                        getCellColor(prob)
                      )}
                    >
                      {pct}%
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs font-medium text-gray-400">
        &uarr; {homeTeam} Goals
      </div>
    </div>
  )
}
