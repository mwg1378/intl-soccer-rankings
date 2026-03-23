/**
 * Importance-Weighted Pi-Ratings engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  initIwPi,
  iwPiOverall,
  updateIwPiRatings,
  applyIwPiMeanReversion,
} from "../../lib/iw-pi-engine";

describe("iw-pi-engine", () => {
  describe("initIwPi", () => {
    it("initializes at 0 (neutral)", () => {
      const state = initIwPi();
      expect(state.home).toBe(0);
      expect(state.away).toBe(0);
      expect(iwPiOverall(state)).toBe(0);
    });
  });

  describe("updateIwPiRatings", () => {
    it("home win increases home team rating", () => {
      const home = initIwPi();
      const away = initIwPi();
      const result = updateIwPiRatings(home, away, 2, 0, false, "QUALIFIER");
      expect(iwPiOverall(result.homeTeam)).toBeGreaterThan(0);
      expect(iwPiOverall(result.awayTeam)).toBeLessThan(0);
    });

    it("tournament matches produce larger updates than friendlies", () => {
      const h1 = initIwPi(), a1 = initIwPi();
      const friendly = updateIwPiRatings(h1, a1, 2, 0, false, "FRIENDLY");

      const h2 = initIwPi(), a2 = initIwPi();
      const tournament = updateIwPiRatings(h2, a2, 2, 0, false, "TOURNAMENT_KNOCKOUT");

      expect(Math.abs(iwPiOverall(tournament.homeTeam)))
        .toBeGreaterThan(Math.abs(iwPiOverall(friendly.homeTeam)));
    });

    it("neutral venue updates both home and away ratings equally", () => {
      const home = initIwPi();
      const away = initIwPi();
      const result = updateIwPiRatings(home, away, 1, 0, true, "QUALIFIER");
      // Both home and away sub-ratings should change equally
      expect(result.homeTeam.home).toBeCloseTo(result.homeTeam.away, 10);
    });

    it("draw keeps ratings near zero for equal teams", () => {
      const home = initIwPi();
      const away = initIwPi();
      const result = updateIwPiRatings(home, away, 1, 1, false, "QUALIFIER");
      expect(Math.abs(iwPiOverall(result.homeTeam))).toBeLessThan(0.1);
    });
  });

  describe("applyIwPiMeanReversion", () => {
    it("pulls ratings toward 0", () => {
      const state = { home: 1.5, away: 0.8 };
      const reverted = applyIwPiMeanReversion(state);
      expect(reverted.home).toBeLessThan(1.5);
      expect(reverted.away).toBeLessThan(0.8);
      expect(reverted.home).toBeGreaterThan(0);
    });

    it("does not change zero ratings", () => {
      const state = initIwPi();
      const reverted = applyIwPiMeanReversion(state);
      expect(reverted.home).toBe(0);
      expect(reverted.away).toBe(0);
    });
  });
});
