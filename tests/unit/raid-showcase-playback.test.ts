import { describe, expect, it } from "vitest";
import { counterImpactMs, counterLaunchMs, createShowcasePlayback, rpsRevealMs, showcaseCounterFrame, showcaseFrame, showcaseRpsFrame } from "../../src/lib/raid-showcase-playback";

describe("shared raid presentation timeline", () => {
  it.each([["attack", 90], ["critical", 140]] as const)("freezes %s at contact for %i ms and releases HP with recoil", (cue, stopMs) => {
    expect(showcaseFrame(cue, 649).phase).toBe("flight");
    for (const elapsed of [650, 650 + stopMs / 2, 650 + stopMs - 1]) {
      const frame = showcaseFrame(cue, elapsed);
      expect(frame.phase).toBe("hitstop");
      expect(frame.visualMs).toBe(650);
      expect(frame.hpProgress).toBe(0);
    }
    const release = showcaseFrame(cue, 650 + stopMs);
    expect(release.phase).toBe("reaction");
    expect(release.visualMs).toBe(650);
    const moving = showcaseFrame(cue, 650 + stopMs + 20);
    expect(moving.visualMs).toBeGreaterThan(650);
    expect(moving.hpProgress).toBeGreaterThan(0);
    expect(showcaseFrame(cue, 650 + stopMs + 350).hpProgress).toBe(1);
  });
  it("preserves the remaining hitstop across pause/resume and clears it on replay", () => {
    let now = 0;
    const playback = createShowcasePlayback(() => now);
    playback.play("critical"); now = 700;
    playback.pause(true); const frozen = playback.sample();
    now += 10000;
    expect(playback.sample()).toEqual(frozen);
    playback.pause(false); now += 89;
    expect(playback.sample().phase).toBe("hitstop");
    now += 1;
    expect(playback.sample().phase).toBe("reaction");
    playback.play("critical");
    expect(playback.sample().phase).toBe("flight");
    expect(playback.sample().elapsedMs).toBe(0);
  });
  it("does not insert combat hitstops into healing and victory", () => {
    for (const cue of ["idle", "rps", "heal", "counter", "weaken", "victory"] as const) {
      expect(showcaseFrame(cue, 700)).toMatchObject({ visualMs: 700, phase: "idle", hpProgress: 1 });
    }
  });
  it.each(["rock", "scissors", "paper"] as const)("reveals the confirmed %s on pon and keeps it fixed across pause/resume", (result) => {
    expect(showcaseRpsFrame(0, result)).toMatchObject({ revealed: false, beat: 0 });
    expect(showcaseRpsFrame(700, result).beat).toBe(1);
    expect(showcaseRpsFrame(1400, result).beat).toBe(2);
    expect(showcaseRpsFrame(rpsRevealMs - 1, result).revealed).toBe(false);
    expect(showcaseRpsFrame(rpsRevealMs, result)).toMatchObject({ revealed: true, beat: 3, hand: result });
    let now = 0;
    const playback = createShowcasePlayback(() => now);
    playback.play("rps", result); now = rpsRevealMs - 100;
    playback.pause(true); now += 5000;
    expect(showcaseRpsFrame(playback.sample().visualMs, playback.sample().bossHand).revealed).toBe(false);
    playback.pause(false); now += 100;
    expect(showcaseRpsFrame(playback.sample().visualMs, playback.sample().bossHand)).toMatchObject({ hand: result, revealed: true });
    now += 10000;
    expect(showcaseRpsFrame(playback.sample().visualMs, playback.sample().bossHand).hand).toBe(result);
  });
  it("charges and sends the breath before impact, then recoils and returns the team to rest", () => {
    const charging = showcaseCounterFrame(counterLaunchMs - 1);
    expect(charging.charge).toBeGreaterThan(.9);
    expect(charging.beam).toBe(0);
    expect(charging.impact).toBe(0);
    expect(charging.recoil).toBe(0);
    const traveling = showcaseCounterFrame(counterLaunchMs + 300);
    expect(traveling.flight).toBeGreaterThan(0);
    expect(traveling.flight).toBeLessThan(1);
    expect(traveling.recoil).toBe(0);
    expect(showcaseCounterFrame(counterImpactMs - 1).impact).toBe(0);
    expect(showcaseCounterFrame(counterImpactMs).impact).toBe(1);
    const struck = showcaseCounterFrame(counterImpactMs + 100);
    expect(struck.flight).toBe(1);
    expect(struck.recoil).toBe(1);
    expect(struck.slide).toBeGreaterThan(0);
    const recovered = showcaseCounterFrame(3400);
    expect(recovered).toMatchObject({ charge: 0, beam: 0, impact: 0, recoil: 0, slide: 0 });
    expect(showcaseCounterFrame(0)).toMatchObject({ charge: 0, flight: 0, beam: 0, impact: 0, recoil: 0, slide: 0 });
  });
});
