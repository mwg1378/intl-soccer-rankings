"use client"

import { ProbabilityBar } from "@/components/predict/probability-bar"
import { ScoreMatrix } from "@/components/predict/score-matrix"
import { TopScorelines, type Scoreline } from "@/components/predict/top-scorelines"

export interface PredictionResult {
  homeTeam: string
  awayTeam: string
  homeExpectedGoals: number
  awayExpectedGoals: number
  homeWinProb: number
  drawProb: number
  awayWinProb: number
  scoreMatrix: number[][]
  topScorelines: Scoreline[]
}

interface PredictionDisplayProps {
  prediction: PredictionResult
}

export function PredictionDisplay({ prediction }: PredictionDisplayProps) {
  const {
    homeTeam,
    awayTeam,
    homeExpectedGoals,
    awayExpectedGoals,
    homeWinProb,
    drawProb,
    awayWinProb,
    scoreMatrix,
    topScorelines,
  } = prediction

  return (
    <div className="flex flex-col gap-6">
      {/* Expected Goals */}
      <div className="flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-gray-500">
            {homeTeam}
          </span>
          <span className="text-3xl font-bold tabular-nums">
            {homeExpectedGoals.toFixed(2)}
          </span>
          <span className="text-xs text-gray-400">Expected Goals</span>
        </div>
        <span className="text-2xl font-light text-gray-300">vs</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-gray-500">
            {awayTeam}
          </span>
          <span className="text-3xl font-bold tabular-nums">
            {awayExpectedGoals.toFixed(2)}
          </span>
          <span className="text-xs text-gray-400">Expected Goals</span>
        </div>
      </div>

      {/* Win Probability Bar */}
      <div className="overflow-hidden rounded border border-gray-200">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h3 className="text-sm font-semibold text-white">Win Probability</h3>
        </div>
        <div className="p-4">
          <ProbabilityBar
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeWinProb={homeWinProb}
            drawProb={drawProb}
            awayWinProb={awayWinProb}
          />
        </div>
      </div>

      {/* Score Matrix and Top Scorelines side by side on larger screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded border border-gray-200">
          <div className="bg-[#1a2b4a] px-4 py-2">
            <h3 className="text-sm font-semibold text-white">Score Probabilities</h3>
          </div>
          <div className="p-4">
            <ScoreMatrix
              matrix={scoreMatrix}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded border border-gray-200">
          <div className="bg-[#1a2b4a] px-4 py-2">
            <h3 className="text-sm font-semibold text-white">Most Likely Scores</h3>
          </div>
          <div className="p-4">
            <TopScorelines
              scorelines={topScorelines}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
