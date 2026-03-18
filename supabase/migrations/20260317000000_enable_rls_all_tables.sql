-- Enable Row Level Security on all public tables
-- Data is written via Prisma (direct DB connection, bypasses RLS).
-- PostgREST (anon key) only needs read access.

ALTER TABLE "public"."Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RankingSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TeamRoster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlayerSeasonStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeagueCoefficient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PredictionCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Player" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WorldCupSimulation" ENABLE ROW LEVEL SECURITY;

-- Allow public read access via anon role
CREATE POLICY "Allow public read access" ON "public"."Team" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."Match" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."RankingSnapshot" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."TeamRoster" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."PlayerSeasonStats" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."LeagueCoefficient" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."PredictionCache" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."Player" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON "public"."WorldCupSimulation" FOR SELECT TO anon USING (true);

-- Allow authenticated users read access as well
CREATE POLICY "Allow authenticated read access" ON "public"."Team" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."Match" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."RankingSnapshot" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."TeamRoster" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."PlayerSeasonStats" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."LeagueCoefficient" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."PredictionCache" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."Player" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."WorldCupSimulation" FOR SELECT TO authenticated USING (true);
