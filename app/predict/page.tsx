"use client";

import { useState } from "react";
import useSWR from "swr";
import { TeamSelector } from "@/components/predict/team-selector";
import { PredictionDisplay } from "@/components/predict/prediction-display";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PredictPage() {
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
  const [venue, setVenue] = useState<string>("HOME");
  const [importance, setImportance] = useState<string>("FRIENDLY");

  const { data: teamsData } = useSWR("/api/rankings?pageSize=211", fetcher);
  const teams = teamsData?.teams ?? [];

  const canPredict = homeTeamId && awayTeamId && homeTeamId !== awayTeamId;

  const predictionParams = canPredict
    ? new URLSearchParams({
        homeTeamId: homeTeamId!,
        awayTeamId: awayTeamId!,
        venue,
        importance,
      }).toString()
    : null;

  const { data: prediction, isLoading: predicting } = useSWR(
    predictionParams ? `/api/predict?${predictionParams}` : null,
    fetcher
  );

  const homeTeam = teams.find((t: { id: string }) => t.id === homeTeamId);
  const awayTeam = teams.find((t: { id: string }) => t.id === awayTeamId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Match Predictor</h1>
        <p className="text-sm text-gray-400">
          Select two teams to see score-level probability predictions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Match Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TeamSelector
              teams={teams}
              selected={homeTeamId}
              onSelect={setHomeTeamId}
              label="Home Team"
            />
            <TeamSelector
              teams={teams}
              selected={awayTeamId}
              onSelect={setAwayTeamId}
              label="Away Team"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Venue</label>
              <Select value={venue} onValueChange={(v) => v && setVenue(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Home Team</SelectItem>
                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                  <SelectItem value="AWAY">Away Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Importance</label>
              <Select value={importance} onValueChange={(v) => v && setImportance(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRIENDLY">Friendly</SelectItem>
                  <SelectItem value="QUALIFIER">Qualifier</SelectItem>
                  <SelectItem value="NATIONS_LEAGUE">Nations League</SelectItem>
                  <SelectItem value="TOURNAMENT_GROUP">
                    Tournament Group
                  </SelectItem>
                  <SelectItem value="TOURNAMENT_KNOCKOUT">
                    Tournament Knockout
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {homeTeamId === awayTeamId && homeTeamId && (
            <p className="mt-2 text-sm text-destructive">
              Please select two different teams.
            </p>
          )}
        </CardContent>
      </Card>

      {predicting && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a2b4a]" />
        </div>
      )}

      {prediction && homeTeam && awayTeam && !predicting && (
        <PredictionDisplay
          prediction={{
            homeTeam: homeTeam.name,
            awayTeam: awayTeam.name,
            homeExpectedGoals: prediction.homeExpectedGoals,
            awayExpectedGoals: prediction.awayExpectedGoals,
            homeWinProb: prediction.homeWinProb,
            drawProb: prediction.drawProb,
            awayWinProb: prediction.awayWinProb,
            scoreMatrix: prediction.scoreMatrix,
            topScorelines: prediction.topScorelines,
          }}
        />
      )}
    </div>
  );
}
