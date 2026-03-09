import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10))
  );
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
  ];
  const orderField = validSortFields.includes(sortBy) ? sortBy : "currentRank";
  const orderDir = orderField === "currentRank" ? "asc" : "desc";

  try {
    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        orderBy: { [orderField]: orderDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.team.count({ where }),
    ]);

    return NextResponse.json({ teams, total, page, pageSize });
  } catch (error) {
    console.error("Rankings API error:", error);
    return NextResponse.json(
      { error: "Database error", details: String(error) },
      { status: 500 }
    );
  }
}
