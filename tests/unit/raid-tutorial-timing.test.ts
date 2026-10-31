import { describe, expect, it } from "vitest";
import { raidTutorialSeconds, raidTutorialStep } from "../../src/lib/raid-tutorial-timing";

describe("OpeningVoice scene timing", () => {
  it.each([
    [0, 0], [15, 0], [15.999, 0], [16, 1], [25.999, 1],
    [26, 2], [37.999, 2], [38, 3], [48, 3], [48.927, 3], [49, 3],
  ])("shows the expected scene at %s seconds", (elapsed, step) => {
    expect(raidTutorialStep(raidTutorialSeconds - elapsed)).toBe(step);
  });

  it("leaves room for the full 48.927-second audio before battle", () => {
    expect(raidTutorialSeconds).toBe(49);
    expect(raidTutorialSeconds).toBeGreaterThan(48.92733333333333);
  });
});
