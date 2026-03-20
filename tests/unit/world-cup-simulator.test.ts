/**
 * World Cup simulator integrity tests.
 *
 * Regression test for the playoff qualification bug where playoff teams
 * (Italy, Denmark, etc.) showed 100% qualification probability due to
 * double-counting in the advancement odds logic.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SIMULATOR_PATH = join(__dirname, "../../lib/world-cup-simulator.ts");
const DATA_PATH = join(__dirname, "../../lib/world-cup-data.ts");

describe("World Cup simulator", () => {
  const simulatorSrc = readFileSync(SIMULATOR_PATH, "utf-8");
  const dataSrc = readFileSync(DATA_PATH, "utf-8");

  describe("playoff qualification tracking", () => {
    it("should not double-count playoff winners as confirmed teams", () => {
      // The bug: code checked `playoffResults.has(teamName)` but playoffResults
      // keys are placeholders like "__UEFA_A__", not team names. This caused
      // the condition to always be true, double-counting playoff winners.
      //
      // The fix: use a separate `playoffWinnerNames` Set with actual team names.
      expect(simulatorSrc).toContain("playoffWinnerNames");
      expect(simulatorSrc).toContain("!playoffWinnerNames.has(t)");

      // Ensure we're NOT using the broken pattern of checking placeholder keys
      expect(simulatorSrc).not.toMatch(
        /if\s*\(\s*!playoffResults\.has\(t\)\s*\)/
      );
    });

    it("should count playoff winners exactly once for qualification", () => {
      // playoffWinnerNames should be populated from playoffResults values
      expect(simulatorSrc).toContain("playoffWinnerNames.add(winner)");

      // Qualification should be incremented for playoff winners
      const qualifyLines = simulatorSrc.split("\n").filter(
        (l) => l.includes("qualify++") || l.includes(".qualify +=")
      );
      // Should have exactly 2 qualify increments: one for playoff winners,
      // one for confirmed teams (excluding playoff winners)
      expect(qualifyLines.length).toBe(2);
    });
  });

  describe("playoff team data consistency", () => {
    it("every UEFA playoff path should have exactly 4 contenders (2 semis)", () => {
      const uefaPlayoffMatches = dataSrc.match(
        /semi1:\s*\[.*?\],\s*semi2:\s*\[.*?\]/g
      );
      expect(uefaPlayoffMatches).not.toBeNull();
      expect(uefaPlayoffMatches!.length).toBe(4); // 4 UEFA paths (A, B, C, D)
    });

    it("every FIFA playoff path should have a semi and final opponent", () => {
      const fifaPlayoffs = dataSrc.match(/semi:\s*\[.*?\],\s*finalOpponent:/g);
      expect(fifaPlayoffs).not.toBeNull();
      expect(fifaPlayoffs!.length).toBe(2); // 2 FIFA paths
    });

    it("should define exactly 6 playoff placeholders (4 UEFA + 2 FIFA)", () => {
      // Count PLAYOFF_ constant exports
      // 6 placeholder constants + 1 PLAYOFF_TEAMS array = 7 total PLAYOFF_ exports
      const playoffPlaceholders = dataSrc.match(/export const PLAYOFF_(?:UEFA|FIFA)/g) ?? [];
      expect(playoffPlaceholders.length).toBe(6);

      // Each placeholder should appear in GROUPS
      expect(dataSrc).toContain("PLAYOFF_UEFA_A");
      expect(dataSrc).toContain("PLAYOFF_UEFA_B");
      expect(dataSrc).toContain("PLAYOFF_UEFA_C");
      expect(dataSrc).toContain("PLAYOFF_UEFA_D");
      expect(dataSrc).toContain("PLAYOFF_FIFA_1");
      expect(dataSrc).toContain("PLAYOFF_FIFA_2");
    });
  });

  describe("advancement odds invariants", () => {
    it("should compute probQualify by dividing by iterations (not by group appearances)", () => {
      // probQualify should be counter.qualify / iterations (total sim runs)
      // NOT counter.qualify / some_other_denominator
      expect(simulatorSrc).toMatch(/probQualify:\s*counter\.qualify\s*\/\s*iterations/);
    });

    it("should compute group odds by dividing by total group appearances", () => {
      // Group finish probabilities should sum based on finishPos totals
      expect(simulatorSrc).toMatch(/counter\.finishPos\.reduce/);
    });

    it("R32 matches should total 16", () => {
      const r32Matches = dataSrc.match(/\{\s*num:\s*\d+,\s*home:/g);
      // Count matches in R32_MATCHES array (nums 73-88)
      const r32Section = dataSrc.slice(
        dataSrc.indexOf("export const R32_MATCHES"),
        dataSrc.indexOf("export const R16_MATCHES")
      );
      const matchCount = (r32Section.match(/\{\s*num:/g) ?? []).length;
      expect(matchCount).toBe(16);
    });
  });
});
