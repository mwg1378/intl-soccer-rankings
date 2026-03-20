/**
 * Match history display tests.
 *
 * Regression test for the W/L/D display bug where the result badge showed
 * wins as losses (and vice versa) for away teams, because getResult()
 * double-inverted scores that were already mapped to team perspective.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const COMPONENT_PATH = join(__dirname, "../../components/team/match-history.tsx");
const TEAM_PAGE_PATH = join(__dirname, "../../app/team/[teamSlug]/page.tsx");

describe("match history display", () => {
  const componentSrc = readFileSync(COMPONENT_PATH, "utf-8");
  const teamPageSrc = readFileSync(TEAM_PAGE_PATH, "utf-8");

  describe("W/L/D result badge", () => {
    it("should compute result from pre-mapped scores without checking isHome", () => {
      // The bug: getResult() used isHome to flip scores that were ALREADY
      // mapped to team perspective by the team page, causing double-inversion.
      // The fix: compare homeScore > awayScore directly (they're already teamGoals/opponentGoals).
      expect(componentSrc).not.toMatch(
        /match\.isHome\s*\?\s*match\.homeScore\s*:\s*match\.awayScore/
      );
    });

    it("should not reference isHome in the result calculation", () => {
      // Extract the getResult function body
      const getResultMatch = componentSrc.match(
        /function getResult[\s\S]*?return "L";\s*\n\}/
      );
      expect(getResultMatch).not.toBeNull();
      const getResultBody = getResultMatch![0];
      expect(getResultBody).not.toContain("isHome");
    });
  });

  describe("team page score mapping", () => {
    it("should map homeScore to goalsFor (team perspective)", () => {
      // The team page should set homeScore = goalsFor (the viewed team's goals)
      expect(teamPageSrc).toContain("homeScore: goalsFor");
    });

    it("should map awayScore to goalsAgainst (opponent perspective)", () => {
      expect(teamPageSrc).toContain("awayScore: goalsAgainst");
    });
  });

  describe("score display", () => {
    it("should use venue field for H/A/N indicator (not isHome)", () => {
      // Score should show venue (H/A/N) from the pre-computed venue field,
      // not derive it from isHome (which would miss neutral venues).
      expect(componentSrc).toContain("match.venue");
    });
  });
});
