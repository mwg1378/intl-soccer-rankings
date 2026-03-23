/**
 * Margin-Optimized Elo engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  initMoElo,
  moEloOverall,
  processMoEloMatch,
  applyMoEloReversion,
} from "../../lib/mo-elo-engine";

describe("mo-elo-engine", () => {
  describe("initMoElo", () => {
    it("initializes at 1500 overall", () => {
      const state = initMoElo();
      expect(moEloOverall(state)).toBe(1500);
      expect(state.offensive).toBe(1500);
      expect(state.defensive).toBe(1500);
    });
  });

  describe("processMoEloMatch", () => {
    it("winner gains rating, loser drops", () => {
      const home = initMoElo();
      const away = initMoElo();
      const result = processMoEloMatch(home, away, 2, 0, "QUALIFIER", false);
      expect(moEloOverall(result.home)).toBeGreaterThan(1500);
      expect(moEloOverall(result.away)).toBeLessThan(1500);
    });

    it("larger margins produce larger rating changes", () => {
      const h1 = initMoElo(), a1 = initMoElo();
      const narrow = processMoEloMatch(h1, a1, 1, 0, "QUALIFIER", false);

      const h2 = initMoElo(), a2 = initMoElo();
      const wide = processMoEloMatch(h2, a2, 4, 0, "QUALIFIER", false);

      const narrowGain = moEloOverall(narrow.home) - 1500;
      const wideGain = moEloOverall(wide.home) - 1500;
      expect(wideGain).toBeGreaterThan(narrowGain);
    });

    it("draw keeps ratings equal for equal teams", () => {
      const home = initMoElo();
      const away = initMoElo();
      const result = processMoEloMatch(home, away, 1, 1, "QUALIFIER", false);
      expect(moEloOverall(result.home)).toBeCloseTo(moEloOverall(result.away), 5);
    });

    it("PSO winner gets slight advantage", () => {
      const home = initMoElo();
      const away = initMoElo();
      const result = processMoEloMatch(home, away, 1, 1, "TOURNAMENT_KNOCKOUT", false, 5, 4);
      expect(moEloOverall(result.home)).toBeGreaterThan(moEloOverall(result.away));
    });

    it("knockout loss protection prevents negative deltas", () => {
      // Give away team a huge rating advantage
      const home = { offensive: 1300, defensive: 1700 };
      const away = { offensive: 1700, defensive: 1300 };
      const result = processMoEloMatch(home, away, 0, 1, "TOURNAMENT_KNOCKOUT", false);
      // Home should not lose rating in knockout
      expect(moEloOverall(result.home)).toBeGreaterThanOrEqual(moEloOverall(home));
    });

    it("50/50 off/def split on updates", () => {
      const home = initMoElo();
      const away = initMoElo();
      const result = processMoEloMatch(home, away, 2, 0, "QUALIFIER", false);
      const offGain = result.home.offensive - 1500;
      const defGain = 1500 - result.home.defensive;
      expect(offGain).toBeCloseTo(defGain, 10);
    });
  });

  describe("applyMoEloReversion", () => {
    it("pulls ratings toward 1500", () => {
      const state = { offensive: 1600, defensive: 1400 };
      const reverted = applyMoEloReversion(state);
      expect(reverted.offensive).toBeLessThan(1600);
      expect(reverted.defensive).toBeGreaterThan(1400);
    });

    it("does not change ratings at 1500", () => {
      const state = initMoElo();
      const reverted = applyMoEloReversion(state);
      expect(reverted.offensive).toBe(1500);
      expect(reverted.defensive).toBe(1500);
    });
  });
});
