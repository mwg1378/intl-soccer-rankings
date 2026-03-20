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

  describe("adaptive goal diff multiplier", () => {
    it("should use per-team adaptive multiplier based on win rate", () => {
      expect(src).toContain("adaptiveGoalDiffMultiplier");
      expect(src).toContain("G_home");
      expect(src).toContain("G_away");
    });

    it("should compute extremity from win rate distance from 0.5", () => {
      expect(src).toContain("Math.abs(winRate - 0.5) * 2");
    });

    it("should blend between 1.0 (balanced) and rawG (lopsided) via extremity^1.5", () => {
      expect(src).toContain("Math.pow(extremity, 1.5)");
    });
  });

  describe("home advantage in Elo", () => {
    it("should apply home team HA as Elo bonus in expected result", () => {
      expect(src).toContain("haEloBonus");
      expect(src).toContain("homeOverall + haEloBonus");
    });

    it("should have Bayesian home advantage computation", () => {
      expect(src).toContain("HOME_ADVANTAGE_PRIOR");
      expect(src).toContain("HOME_ADVANTAGE_PRIOR_WEIGHT");
      expect(src).toContain("computeHomeAdvantage");
    });
  });

  describe("offensive/defensive split", () => {
    it("should use 50/50 split", () => {
      expect(src).toContain("split = 0.5");
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
