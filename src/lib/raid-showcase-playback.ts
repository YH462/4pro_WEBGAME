import { showcaseImpactMs, type ShowcaseCue } from "./raid-showcase-scenes";
import { raidHands, type RaidHand } from "./raid-rps";

export const rpsRevealMs = 2100;
export function showcaseRpsFrame(elapsedMs: number, result: RaidHand = "paper") {
  const elapsed = Math.max(0, elapsedMs);
  const revealed = elapsed >= rpsRevealMs;
  const beat = Math.min(3, Math.floor(elapsed / 700));
  return {
    hand: revealed ? result : raidHands[Math.floor(elapsed / 350) % raidHands.length].id,
    revealed, beat,
  };
}

export const counterLaunchMs = 900;
export const counterImpactMs = 1550;
const unit = (value: number) => Math.min(1, Math.max(0, value));

/** Breath arrival, flashes and the whole team's recoil share these timings. */
export function showcaseCounterFrame(elapsedMs: number) {
  const elapsed = Math.max(0, elapsedMs);
  const afterHit = elapsed - counterImpactMs;
  const flight = unit((elapsed - counterLaunchMs) / (counterImpactMs - counterLaunchMs));
  const recovery = unit((afterHit - 100) / 1350);
  return {
    charge: unit(elapsed / counterLaunchMs) * (1 - unit((elapsed - counterLaunchMs) / 250)),
    flight,
    beam: elapsed < counterLaunchMs ? 0 : 1 - unit(afterHit / 650),
    impact: afterHit < 0 ? 0 : (1 - unit(afterHit / 800)) ** 2,
    recoil: unit(afterHit / 100) * (1 - recovery) ** 2,
    slide: unit(afterHit / 140) * (1 - recovery * recovery * (3 - 2 * recovery)),
    afterHit: Math.max(0, afterHit) / 1000,
  };
}

export type ShowcaseFrame = {
  cue: ShowcaseCue;
  elapsedMs: number;
  visualMs: number;
  phase: "idle" | "flight" | "hitstop" | "reaction";
  hpProgress: number;
  delayedHpProgress: number;
  bossHand: RaidHand;
};

export function showcaseFrame(cue: ShowcaseCue, elapsedMs: number, bossHand: RaidHand = "paper"): ShowcaseFrame {
  const elapsed = Math.max(0, elapsedMs);
  const attacking = cue === "attack" || cue === "critical";
  if (!attacking) return { cue, elapsedMs: elapsed, visualMs: elapsed, phase: "idle", hpProgress: 1, delayedHpProgress: 1, bossHand };
  const stopMs = cue === "critical" ? 140 : 90;
  const reactionMs = elapsed - showcaseImpactMs - stopMs;
  const progress = Math.min(1, Math.max(0, reactionMs / 350));
  return {
    cue, elapsedMs: elapsed, bossHand,
    visualMs: elapsed < showcaseImpactMs ? elapsed : showcaseImpactMs + Math.max(0, reactionMs),
    phase: elapsed < showcaseImpactMs ? "flight" : reactionMs < 0 ? "hitstop" : "reaction",
    hpProgress: 1 - (1 - progress) ** 3,
    delayedHpProgress: Math.min(1, Math.max(0, (reactionMs - 450) / 900)),
  };
}

/** One clock drives 3D motion, CSS effects, HP, manual pause and tab visibility. */
export function createShowcasePlayback(now: () => number = () => performance.now()) {
  let cue: ShowcaseCue = "idle";
  let bossHand: RaidHand = "paper";
  let startedAt: number | null = null;
  let pausedAt: number | null = null;
  return {
    play(next: ShowcaseCue, hand: RaidHand = "paper") { cue = next; bossHand = hand; startedAt = now(); pausedAt = null; },
    pause(value: boolean) {
      if (value && pausedAt === null) pausedAt = now();
      else if (!value && pausedAt !== null) {
        if (startedAt !== null) startedAt += now() - pausedAt;
        pausedAt = null;
      }
    },
    sample() { return showcaseFrame(cue, startedAt === null ? 0 : (pausedAt ?? now()) - startedAt, bossHand); },
  };
}
