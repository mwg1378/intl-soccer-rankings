import { prisma } from "@/lib/prisma";
import { predictMatch } from "@/lib/prediction-engine";
import { notFound } from "next/navigation";
import { PredictionDisplay } from "@/components/predict/prediction-display";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ matchup: string }>;
}

async function getTeams(matchup: string) {
  const parts = matchup.split("-vs-");
  if (parts.length !== 2) return null;

  const [homeSlug, awaySlug] = parts;
  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({ where: { slug: homeSlug } }),
    prisma.team.findUnique({ where: { slug: awaySlug } }),
  ]);

  if (!homeTeam || !awayTeam) return null;
  return { homeTeam, awayTeam };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchup } = await params;
  const result = await getTeams(matchup);
  if (!result) return { title: "Prediction Not Found" };

  const { homeTeam, awayTeam } = result;

  // Use raw Elo for metadata predictions (same as /api/predict)
  const prediction = predictMatch({
    homeTeam: {
      offensive: homeTeam.eloOffensive,
      defensive: homeTeam.eloDefensive,
    },
    awayTeam: {
      offensive: awayTeam.eloOffensive,
      defensive: awayTeam.eloDefensive,
    },
    neutralVenue: true,
  });

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return {
    title: `${homeTeam.name} vs ${awayTeam.name} — Prediction`,
    description: `${homeTeam.name} ${pct(prediction.homeWinProb)} / Draw ${pct(prediction.drawProb)} / ${awayTeam.name} ${pct(prediction.awayWinProb)}`,
    openGraph: {
      title: `${homeTeam.name} vs ${awayTeam.name}`,
      description: `${pct(prediction.homeWinProb)} / ${pct(prediction.drawProb)} / ${pct(prediction.awayWinProb)}`,
    },
  };
}

export default async function ShareablePredictionPage({ params }: PageProps) {
  const { matchup } = await params;
  const result = await getTeams(matchup);
  if (!result) notFound();

  const { homeTeam, awayTeam } = result;

  // Use raw Elo ratings (same as /api/predict) for consistent predictions
  const allTeams = await prisma.team.findMany({
    where: { currentRank: { gt: 0 } },
    select: { eloOffensive: true, eloDefensive: true },
  });

  const n = allTeams.length;
  const avgOff = allTeams.reduce((s, t) => s + t.eloOffensive, 0) / n;
  const avgDef = allTeams.reduce((s, t) => s + t.eloDefensive, 0) / n;
  const stdOff = Math.sqrt(
    allTeams.reduce((s, t) => s + (t.eloOffensive - avgOff) ** 2, 0) / n
  );
  const stdDef = Math.sqrt(
    allTeams.reduce((s, t) => s + (t.eloDefensive - avgDef) ** 2, 0) / n
  );

  const prediction = predictMatch({
    homeTeam: {
      offensive: homeTeam.eloOffensive,
      defensive: homeTeam.eloDefensive,
    },
    awayTeam: {
      offensive: awayTeam.eloOffensive,
      defensive: awayTeam.eloDefensive,
    },
    neutralVenue: true,
    avgOffensive: avgOff,
    avgDefensive: avgDef,
    stdOffensive: stdOff,
    stdDefensive: stdDef,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {homeTeam.name} vs {awayTeam.name}
        </h1>
        <p className="text-muted-foreground">Neutral venue prediction</p>
      </div>

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
    </div>
  );
}
