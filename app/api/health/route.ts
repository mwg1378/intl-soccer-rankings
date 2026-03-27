import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  try {
    const teamCount = await prisma.team.count({
      where: { currentRank: { gt: 0 } },
    });
    checks.rankedTeams = {
      ok: teamCount >= 100,
      detail: `${teamCount} ranked teams (expected 100+)`,
    };
  } catch (err) {
    checks.rankedTeams = { ok: false, detail: `query failed: ${err}` };
  }

  try {
    const rosterCount = await prisma.teamRoster.count();
    checks.rosters = {
      ok: rosterCount >= 500,
      detail: `${rosterCount} roster entries (expected 500+)`,
    };
  } catch (err) {
    checks.rosters = { ok: false, detail: `query failed: ${err}` };
  }

  try {
    const sim = await prisma.worldCupSimulation.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, iterations: true },
    });
    checks.simulation = {
      ok: sim !== null,
      detail: sim
        ? `${sim.iterations.toLocaleString()} iterations, created ${sim.createdAt.toISOString()}`
        : "no simulation found",
    };
  } catch (err) {
    checks.simulation = { ok: false, detail: `query failed: ${err}` };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
