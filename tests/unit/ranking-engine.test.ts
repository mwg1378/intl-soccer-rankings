/**
 * Ranking engine tests.
 *
 * Tests for the Elo calculation logic, including the asymmetric goal
 * diff multiplier fix (applied only to positive deltas).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ENGINE_PATH = join(__dirname, "../../lib/ranking-engine.ts");

describe("ranking engine", () => {
  const src = readFileSync(ENGINE_PATH, "utf-8");

  describe("goal diff multiplier asymmetry", () => {
    it("should apply goal diff multiplier only to positive deltas", () => {
      // The fix: blowout losses should NOT be extra-penalized.
      // Only decisive wins get the multiplier boost.
      // Pattern: K * (rawDelta > 0 ? G : 1) * rawDelta
      expect(src).toMatch(/homeRaw > 0 \? G : 1/);
      expect(src).toMatch(/awayRaw > 0 \? G : 1/);
    });

    it("should not apply multiplier symmetrically to both teams", () => {
      // The old pattern: K * G * (W - We) applied G to both winner and loser.
      // Make sure we don't have the old symmetric pattern.
      expect(src).not.toMatch(/K \* G \* \(W_home/);
      expect(src).not.toMatch(/K \* G \* \(W_away/);
    });
  });

  describe("knockout loss protection", () => {
    it("should clamp negative deltas to zero in knockout rounds", () => {
      expect(src).toContain("homeDelta < 0) homeDelta = 0");
      expect(src).toContain("awayDelta < 0) awayDelta = 0");
    });
  });

  describe("expected result formula", () => {
    it("should use 600-point scaling (FIFA standard)", () => {
      expect(src).toContain("/ 600");
    });

    it("should not use 400-point scaling (standard Elo)", () => {
      expect(src).not.toContain("/ 400");
    });
  });

  describe("penalty shootout handling", () => {
    it("PSO loser should get W=0.5 (draw), not W=0.25", () => {
      // FIFA rule: PSO loser is treated as draw
      expect(src).toContain("return [0.75, 0.5]");
      expect(src).toContain("return [0.5, 0.75]");
      // Should NOT have the old 0.25 values
      expect(src).not.toContain("0.25]");
    });
  });
});
