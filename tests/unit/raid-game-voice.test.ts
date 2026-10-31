import { describe, expect, it } from "vitest";
import { RaidGameVoiceTimeline, type RaidGameVoiceState } from "../../src/lib/raid-game-voice";

const battle = (patch: Partial<RaidGameVoiceState> = {}): RaidGameVoiceState => ({
  roomId: "room", phase: "collecting", bossHp: 450, bossMaxHp: 450,
  victory: false, failed: false, ...patch,
});

describe("raid game voice milestones", () => {
  it("counts fifteen seconds from the battle start, excluding the entire opening", () => {
    const timeline = new RaidGameVoiceTimeline();
    expect(timeline.update(battle({ phase: "tutorial", battleStartsInMs: 49_000 }), 0).voice).toBeUndefined();
    expect(timeline.tick(49_000)).toBeUndefined();
    timeline.update(battle({ battleStartsInMs: 0 }), 49_000);
    expect(timeline.tick(63_999)).toBeUndefined(); expect(timeline.tick(64_000)).toBe(1);
    expect(timeline.tick(65_000)).toBeUndefined();
  });

  it("announces each displayed HP threshold once, even after late-join capacity changes", () => {
    const timeline = new RaidGameVoiceTimeline(); timeline.update(battle(), 0);
    expect(timeline.update(battle({ bossHp: 226 }), 1000).voice).toBeUndefined();
    expect(timeline.update(battle({ bossHp: 225 }), 2000).voice).toBe(2);
    expect(timeline.update(battle({ bossHp: 400, bossMaxHp: 900 }), 3000).voice).toBeUndefined();
    expect(timeline.update(battle({ bossHp: 225, bossMaxHp: 900 }), 4000).voice).toBe(3);
    expect(timeline.update(battle({ bossHp: 100 }), 5000).voice).toBeUndefined();
  });

  it("skips outdated half-HP and fatal-hit reminders and waits for the victory scene", () => {
    const timeline = new RaidGameVoiceTimeline(); timeline.update(battle(), 0);
    expect(timeline.update(battle({ bossHp: 100 }), 1000).voice).toBe(3);
    expect(timeline.update(battle({ bossHp: 0 }), 2000).voice).toBeUndefined();
    expect(timeline.update(battle({ bossHp: 0, victory: true }), 3000).voice).toBe(4);
    expect(timeline.update(battle({ bossHp: 0, victory: true, phase: "finished" }), 4000).voice).toBeUndefined();
  });

  it("clears old milestones on reset, and never congratulates a defeated team", () => {
    const timeline = new RaidGameVoiceTimeline(); timeline.update(battle(), 0);
    expect(timeline.update(battle({ bossHp: 200, failed: true, phase: "finished" }), 20_000)).toEqual({ reset: true, voice: undefined });
    expect(timeline.update(battle({ roomId: "next", phase: "lobby" }), 21_000).reset).toBe(true);
    timeline.update(battle({ roomId: "next" }), 22_000);
    expect(timeline.tick(37_000)).toBe(1);
  });
});
