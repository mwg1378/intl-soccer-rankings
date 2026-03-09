import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Team {
  name: string;
  fifaCode: string;
  confederation: string;
  currentRank: number;
  currentOverallRating: number;
  currentOffensiveRating: number;
  currentDefensiveRating: number;
}

interface TeamHeaderProps {
  team: Team;
}

export function TeamHeader({ team }: TeamHeaderProps) {
  const ratingCards = [
    { label: "Overall", value: team.currentOverallRating },
    { label: "Offensive", value: team.currentOffensiveRating },
    { label: "Defensive", value: team.currentDefensiveRating },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          <Badge variant="secondary" className="text-sm">
            {team.fifaCode}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-extrabold tabular-nums text-primary">
            #{team.currentRank}
          </span>
          <Badge variant="outline">{team.confederation}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ratingCards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  card.label === "Overall" && "text-primary"
                )}
              >
                {card.value.toFixed(1)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
