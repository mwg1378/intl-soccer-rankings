import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const rawPageSize = searchParams.get("pageSize");
  const pageSize = rawPageSize === "all"
    ? 999
    : Math.min(200, Math.max(1, parseInt(rawPageSize ?? "50", 10)));
  const confederation = searchParams.get("confederation");
  const sortBy = searchParams.get("sortBy") ?? "currentRank";

  const where = {
    currentRank: { gt: 0 },
    ...(confederation && { confederation: confederation as never }),
  };

  const validSortFields = [
    "currentRank",
    "currentOverallRating",
    "currentOffensiveRating",
    "currentDefensiveRating",
    "eloOffensive",
    "rosterOffensive",
    "btRating",
    "btRank",
    "glickoRating",
    "glickoRank",
    "berrarRating",
    "berrarRank",
    "opRating",
    "opRank",
    "iwPiOverall",
    "iwPiRank",
    "moEloOffensive",
    "moEloRank",
    "gridOptOff",
    "gridOptRank",
    "top3Off",
    "top3Rank",
    "btMktOff",
    "btMktRank",
  ];
  const orderField = validSortFields.includes(sortBy) ? sortBy : "currentRank";
  const rankFields = ["currentRank", "btRank", "glickoRank", "berrarRank", "opRank", "iwPiRank", "moEloRank", "gridOptRank", "top3Rank", "btMktRank"];
  const orderDir = rankFields.includes(orderField) ? "asc" : "desc";

  try {
    const teams = await prisma.team.findMany({
      where,
      orderBy: { [orderField]: orderDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({ teams, total: teams.length, page, pageSize });
  } catch (error) {
    console.error("Rankings API error:", error);
    return NextResponse.json(
      { error: "Database error", details: String(error) },
      { status: 500 }
    );
  }
}
