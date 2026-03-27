import { describe, it, expect } from "vitest";

/**
 * Regression tests for database connection resilience.
 *
 * These tests verify that:
 * 1. The Prisma pool config limits connections to avoid exhausting Supabase pooler
 * 2. Error handling surfaces failures instead of silently returning empty data
 * 3. The rankings API returns proper error responses
 */

describe("database connection pool config", () => {
  it("should use max 1 connection per pool to avoid exhausting Supabase session-mode pooler", async () => {
    // Read the prisma.ts source and verify pool max is 1
    const fs = await import("fs");
    const source = fs.readFileSync("lib/prisma.ts", "utf-8");

    // Extract the max value from pg.Pool config
    const maxMatch = source.match(/max:\s*(\d+)/);
    expect(maxMatch).not.toBeNull();
    expect(parseInt(maxMatch![1], 10)).toBeLessThanOrEqual(1);
  });

  it("should set connection and idle timeouts to release connections promptly", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("lib/prisma.ts", "utf-8");

    expect(source).toContain("idleTimeoutMillis");
    expect(source).toContain("connectionTimeoutMillis");
  });
});

describe("homepage error handling", () => {
  it("should log errors instead of silently swallowing them", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("app/page.tsx", "utf-8");

    // The homepage should NOT have bare .catch(() => []) that hides errors
    expect(source).not.toMatch(/\.catch\(\(\)\s*=>/);
    // It should log errors
    expect(source).toContain("console.error");
  });
});

describe("rankings API error handling", () => {
  it("should return error details in JSON response on failure", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("app/api/rankings/route.ts", "utf-8");

    // Should have try/catch with error logging
    expect(source).toContain("console.error");
    // Should return error details in the response body
    expect(source).toMatch(/details.*String\(error\)/);
    // Should return 500 status on error
    expect(source).toContain("status: 500");
  });

  it("rankings page client should handle and display errors", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("app/rankings/page.tsx", "utf-8");

    // Should destructure error from useSWR
    expect(source).toMatch(/error.*isLoading/);
    // Should have retry config
    expect(source).toContain("retry:");
    // Should render error state, not just "No teams found"
    expect(source).toContain("Failed to load rankings");
  });
});

describe("health check endpoint", () => {
  it("should exist and check ranked team count", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("app/api/health/route.ts", "utf-8");

    // Should check that ranked teams >= 100
    expect(source).toContain("currentRank");
    expect(source).toMatch(/teamCount\s*>=\s*100/);
    // Should return 503 when unhealthy
    expect(source).toContain("503");
  });
});
