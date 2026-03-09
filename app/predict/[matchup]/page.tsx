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

  const avgResult = await prisma.team.aggregate({
    where: { currentRank: { gt: 0 } },
    _avg: {
      currentOffensiveRating: true,
      currentDefensiveRating: true,
    },
  });

  const prediction = predictMatch({
    homeTeam: {
      offensive: homeTeam.currentOffensiveRating,
      defensive: homeTeam.currentDefensiveRating,
    },
    awayTeam: {
      offensive: awayTeam.currentOffensiveRating,
      defensive: awayTeam.currentDefensiveRating,
    },
    neutralVenue: true,
    avgOffensive: avgResult._avg.currentOffensiveRating ?? 1500,
    avgDefensive: avgResult._avg.currentDefensiveRating ?? 1500,
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

  const avgResult = await prisma.team.aggregate({
    where: { currentRank: { gt: 0 } },
    _avg: {
      currentOffensiveRating: true,
      currentDefensiveRating: true,
    },
  });

  const prediction = predictMatch({
    homeTeam: {
      offensive: homeTeam.currentOffensiveRating,
      defensive: homeTeam.currentDefensiveRating,
    },
    awayTeam: {
      offensive: awayTeam.currentOffensiveRating,
      defensive: awayTeam.currentDefensiveRating,
    },
    neutralVenue: true,
    avgOffensive: avgResult._avg.currentOffensiveRating ?? 1500,
    avgDefensive: avgResult._avg.currentDefensiveRating ?? 1500,
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
