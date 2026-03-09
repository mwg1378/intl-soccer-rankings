import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Implement Daily match ingest - fetch yesterday's results from API-Football

  return NextResponse.json({ ok: true, message: "Daily match ingest - fetch yesterday's results from API-Football" });
}
