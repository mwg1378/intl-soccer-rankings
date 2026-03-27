interface Team {
  name: string;
  fifaCode: string;
  confederation: string;
  currentRank: number;
  currentOverallRating: number;
  currentOffensiveRating: number;
  currentDefensiveRating: number;
  homeAdvantage: number;
}

interface TeamHeaderProps {
  team: Team;
}

const confederationColors: Record<string, string> = {
  UEFA: "text-blue-600",
  CONMEBOL: "text-green-600",
  CONCACAF: "text-yellow-600",
  CAF: "text-orange-600",
  AFC: "text-red-600",
  OFC: "text-teal-600",
};

export function TeamHeader({ team }: TeamHeaderProps) {
  const ratingCards = [
    { label: "Overall", value: team.currentOverallRating.toFixed(1), highlight: true },
    { label: "Offensive", value: team.currentOffensiveRating.toFixed(1), highlight: false },
    { label: "Defensive", value: team.currentDefensiveRating.toFixed(1), highlight: false },
    { label: "Home Adv.", value: team.homeAdvantage.toFixed(2) + "x", highlight: false },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{team.name}</h1>
          <span className="text-xs font-semibold text-gray-400">{team.fifaCode}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold tabular-nums text-[#1a2b4a]">
            #{team.currentRank}
          </span>
          <span className={`text-xs font-semibold ${confederationColors[team.confederation] ?? "text-gray-500"}`}>
            {team.confederation}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ratingCards.map((card) => (
          <div key={card.label} className="overflow-hidden rounded border border-gray-200">
            <div className="bg-[#1a2b4a] px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white">
                {card.label}
              </span>
            </div>
            <div className="px-3 py-2">
              <span className={`text-2xl font-bold tabular-nums ${card.highlight ? "text-[#1a2b4a]" : "text-gray-600"}`}>
                {card.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
