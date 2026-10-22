import { describe, expect, it } from "vitest";
import { resolveRaidRps, type RaidHand } from "../../src/lib/raid-rps";

describe("raid rock-paper-scissors", () => {
  it.each<[RaidHand, RaidHand, string, number]>([
    ["rock", "rock", "draw", 1], ["rock", "scissors", "win", 2], ["rock", "paper", "lose", 0.5],
    ["scissors", "rock", "lose", 0.5], ["scissors", "scissors", "draw", 1], ["scissors", "paper", "win", 2],
    ["paper", "rock", "win", 2], ["paper", "scissors", "lose", 0.5], ["paper", "paper", "draw", 1],
  ])("%s vs %s gives %s at %s times the effect", (player, boss, outcome, multiplier) => {
    const result = resolveRaidRps(player, boss);
    expect(result.outcome).toBe(outcome);
    expect(result.multiplier).toBe(multiplier);
  });
});
