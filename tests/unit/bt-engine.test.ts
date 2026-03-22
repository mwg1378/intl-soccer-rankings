/**
 * Bradley-Terry engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  getScorelineW,
  timeDecayWeight,
  btExpectedResult,
  solveBradleyTerry,
  BT_HOME_ADVANTAGE,
  HALF_LIFE_DAYS,
  type BTMatch,
} from "../../lib/bt-engine";

describe("bt-engine", () => {
  describe("getScorelineW", () => {
    it("returns 0.5 for draws", () => {
      expect(getScorelineW(0, 0)).toBe(0.5);
      expect(getScorelineW(1, 1)).toBe(0.5);
      expect(getScorelineW(3, 3)).toBe(0.5);
    });

    it("returns > 0.5 for home wins", () => {
      expect(getScorelineW(1, 0)).toBeGreaterThan(0.5);
      expect(getScorelineW(3, 0)).toBeGreaterThan(0.5);
    });

    it("returns < 0.5 for away wins", () => {
      expect(getScorelineW(0, 1)).toBeLessThan(0.5);
      expect(getScorelineW(0, 3)).toBeLessThan(0.5);
    });

    it("is monotonic: 1-0 > 2-1 > 3-2 > 4-3 (clean wins better)", () => {
      const w10 = getScorelineW(1, 0);
      const w21 = getScorelineW(2, 1);
      const w32 = getScorelineW(3, 2);
      const w43 = getScorelineW(4, 3);
      expect(w10).toBeGreaterThan(w21);
      expect(w21).toBeGreaterThan(w32);
      expect(w32).toBeGreaterThan(w43);
    });

    it("is monotonic: bigger goal diff = bigger W", () => {
      const w10 = getScorelineW(1, 0);
      const w20 = getScorelineW(2, 0);
      const w30 = getScorelineW(3, 0);
      expect(w30).toBeGreaterThan(w20);
      expect(w20).toBeGreaterThan(w10);
    });

    it("3-1 > 3-2 (same goals for, fewer conceded)", () => {
      expect(getScorelineW(3, 1)).toBeGreaterThan(getScorelineW(3, 2));
    });

    it("handles PSO: winner gets 0.55, loser gets 0.45", () => {
      expect(getScorelineW(1, 1, 5, 4)).toBe(0.55);
      expect(getScorelineW(1, 1, 4, 5)).toBe(0.45);
    });

    it("is symmetric: W_home(h,a) = 1 - W_home(a,h)", () => {
      const w = getScorelineW(3, 1);
      const wMirror = getScorelineW(1, 3);
      expect(w + wMirror).toBeCloseTo(1, 4);
    });

    it("handles rare blowout scorelines via sigmoid fallback", () => {
      const w = getScorelineW(10, 0);
      expect(w).toBeGreaterThan(0.8);
      expect(w).toBeLessThan(1);
    });
  });

  describe("timeDecayWeight", () => {
    it("returns 1 for same day", () => {
      const d = new Date("2024-06-01");
      expect(timeDecayWeight(d, d)).toBe(1);
    });

    it("returns ~0.5 at half-life (2 years)", () => {
      const match = new Date("2022-06-01");
      const ref = new Date("2024-06-01");
      expect(timeDecayWeight(match, ref)).toBeCloseTo(0.5, 1);
    });

    it("returns ~0.25 at 4 years", () => {
      const match = new Date("2020-06-01");
      const ref = new Date("2024-06-01");
      expect(timeDecayWeight(match, ref)).toBeCloseTo(0.25, 1);
    });

    it("returns 1 for future matches", () => {
      const match = new Date("2025-01-01");
      const ref = new Date("2024-01-01");
      expect(timeDecayWeight(match, ref)).toBe(1);
    });
  });

  describe("btExpectedResult", () => {
    it("returns 0.5 for equal ratings with no home bonus", () => {
      expect(btExpectedResult(1500, 1500, 0)).toBe(0.5);
    });

    it("returns > 0.5 when teamA is higher rated", () => {
      expect(btExpectedResult(1600, 1500, 0)).toBeGreaterThan(0.5);
    });

    it("returns < 0.5 when teamA is lower rated", () => {
      expect(btExpectedResult(1400, 1500, 0)).toBeLessThan(0.5);
    });

    it("home bonus favors teamA", () => {
      const noBonus = btExpectedResult(1500, 1500, 0);
      const withBonus = btExpectedResult(1500, 1500, BT_HOME_ADVANTAGE);
      expect(withBonus).toBeGreaterThan(noBonus);
    });

    it("600-point difference gives ~10:1 odds", () => {
      const e = btExpectedResult(2100, 1500, 0);
      expect(e).toBeCloseTo(0.909, 2); // 10/11
    });
  });

  describe("solveBradleyTerry", () => {
    it("converges with all draws to equal ratings", () => {
      const teamIds = ["A", "B", "C"];
      const matches: BTMatch[] = [
        { homeTeamIndex: 0, awayTeamIndex: 1, wHome: 0.5, weight: 10, isNeutral: true },
        { homeTeamIndex: 1, awayTeamIndex: 2, wHome: 0.5, weight: 10, isNeutral: true },
        { homeTeamIndex: 2, awayTeamIndex: 0, wHome: 0.5, weight: 10, isNeutral: true },
      ];

      const result = solveBradleyTerry(teamIds, matches);
      const ratings = [...result.ratings.values()];

      // All should be approximately 1500
      for (const r of ratings) {
        expect(r).toBeCloseTo(1500, 0);
      }
      expect(result.maxChange).toBeLessThan(1.0);
    });

    it("ranks the dominant team highest", () => {
      const teamIds = ["Strong", "Medium", "Weak"];
      const matches: BTMatch[] = [];

      // Strong beats Medium, Medium beats Weak, Strong beats Weak
      for (let i = 0; i < 10; i++) {
        matches.push(
          { homeTeamIndex: 0, awayTeamIndex: 1, wHome: 0.65, weight: 10, isNeutral: true },
          { homeTeamIndex: 1, awayTeamIndex: 2, wHome: 0.65, weight: 10, isNeutral: true },
          { homeTeamIndex: 0, awayTeamIndex: 2, wHome: 0.75, weight: 10, isNeutral: true }
        );
      }

      const result = solveBradleyTerry(teamIds, matches);
      const strong = result.ratings.get("Strong")!;
      const medium = result.ratings.get("Medium")!;
      const weak = result.ratings.get("Weak")!;

      expect(strong).toBeGreaterThan(medium);
      expect(medium).toBeGreaterThan(weak);
    });

    it("home advantage does not inflate ratings", () => {
      // Two equal teams, each winning at home. Without proper handling,
      // this could inflate both ratings.
      const teamIds = ["A", "B"];
      const matches: BTMatch[] = [];

      for (let i = 0; i < 20; i++) {
        matches.push(
          { homeTeamIndex: 0, awayTeamIndex: 1, wHome: 0.6, weight: 10, isNeutral: false },
          { homeTeamIndex: 1, awayTeamIndex: 0, wHome: 0.6, weight: 10, isNeutral: false }
        );
      }

      const result = solveBradleyTerry(teamIds, matches);
      const a = result.ratings.get("A")!;
      const b = result.ratings.get("B")!;

      // Should be roughly equal since the pattern is symmetric
      expect(Math.abs(a - b)).toBeLessThan(5);
      // And close to 1500 (not inflated)
      expect(a).toBeCloseTo(1500, -1);
    });

    it("recent matches matter more than old ones (via weight)", () => {
      const teamIds = ["A", "B"];
      // Old matches: A beats B (but low weight)
      // Recent matches: B beats A (high weight)
      const matches: BTMatch[] = [
        // 10 old matches where A beats B, weight=1 (decayed)
        ...Array.from({ length: 10 }, () => ({
          homeTeamIndex: 0,
          awayTeamIndex: 1,
          wHome: 0.65,
          weight: 1,
          isNeutral: true,
        })),
        // 10 recent matches where B beats A, weight=10
        ...Array.from({ length: 10 }, () => ({
          homeTeamIndex: 0,
          awayTeamIndex: 1,
          wHome: 0.35,
          weight: 10,
          isNeutral: true,
        })),
      ];

      const result = solveBradleyTerry(teamIds, matches);
      const a = result.ratings.get("A")!;
      const b = result.ratings.get("B")!;

      // B should be rated higher due to more heavily weighted recent wins
      expect(b).toBeGreaterThan(a);
    });

    it("warm start converges faster", () => {
      const teamIds = ["A", "B", "C", "D"];
      const matches: BTMatch[] = [
        { homeTeamIndex: 0, awayTeamIndex: 1, wHome: 0.7, weight: 10, isNeutral: true },
        { homeTeamIndex: 1, awayTeamIndex: 2, wHome: 0.7, weight: 10, isNeutral: true },
        { homeTeamIndex: 2, awayTeamIndex: 3, wHome: 0.7, weight: 10, isNeutral: true },
        { homeTeamIndex: 0, awayTeamIndex: 3, wHome: 0.8, weight: 10, isNeutral: true },
      ];

      // Cold start
      const cold = solveBradleyTerry(teamIds, matches);

      // Warm start with the cold-start result
      const warm = solveBradleyTerry(teamIds, matches, {
        warmStart: cold.ratings,
      });

      expect(warm.iterations).toBeLessThanOrEqual(cold.iterations);
    });

    it("handles teams with no matches gracefully", () => {
      const teamIds = ["A", "B", "NoMatches"];
      const matches: BTMatch[] = [
        { homeTeamIndex: 0, awayTeamIndex: 1, wHome: 0.7, weight: 10, isNeutral: true },
      ];

      const result = solveBradleyTerry(teamIds, matches);
      // Team with no matches should stay at default
      expect(result.ratings.get("NoMatches")).toBe(1500);
    });
  });
});
