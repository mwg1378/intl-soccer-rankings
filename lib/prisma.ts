import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makePrismaClient() {
  const connectionString =
    process.env.DATABASE_URL || process.env.DIRECT_URL!;

  // Parse connection string to pass user/host/etc individually,
  // because pg.Pool can mangle dotted usernames (e.g. "postgres.ref")
  // which Supabase Supavisor needs for tenant resolution.
  const url = new URL(connectionString);
  const pool = new pg.Pool({
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: parseInt(url.port || "5432", 10),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || makePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
