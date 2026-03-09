"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
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
          <span className="text-sm font-medium text-muted-foreground">
            {homeTeam}
          </span>
          <span className="text-3xl font-bold tabular-nums">
            {homeExpectedGoals.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">Expected Goals</span>
        </div>
        <span className="text-2xl font-light text-muted-foreground">vs</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            {awayTeam}
          </span>
          <span className="text-3xl font-bold tabular-nums">
            {awayExpectedGoals.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">Expected Goals</span>
        </div>
      </div>

      {/* Win Probability Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Win Probability</CardTitle>
          <CardDescription>
            Predicted outcome probabilities for this match
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProbabilityBar
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeWinProb={homeWinProb}
            drawProb={drawProb}
            awayWinProb={awayWinProb}
          />
        </CardContent>
      </Card>

      {/* Score Matrix and Top Scorelines side by side on larger screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Score Probabilities</CardTitle>
            <CardDescription>
              Probability of each exact scoreline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreMatrix
              matrix={scoreMatrix}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Likely Scores</CardTitle>
            <CardDescription>
              Top 10 most probable scorelines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopScorelines
              scorelines={topScorelines}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
