import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sim = await prisma.worldCupSimulation.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!sim) {
      return NextResponse.json(
        { error: "No simulation data available" },
        { status: 404 }
      );
    }

    return NextResponse.json(sim);
  } catch (error) {
    console.error("World Cup API error:", error);
    return NextResponse.json(
      { error: "Database error", details: String(error) },
      { status: 500 }
    );
  }
}
