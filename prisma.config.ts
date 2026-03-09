import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct URL for migrations/schema push, pooler URL for queries
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
