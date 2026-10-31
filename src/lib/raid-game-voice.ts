import type { LocalRaidSnapshot } from "./local-raid-types";

export type GameVoice = 1 | 2 | 3 | 4 | 5;
export const gameVoiceAudio = (voice: GameVoice) => `/music/GameVoice${voice}.mp3`;
export type RaidGameVoiceState = {
  roomId: string;
  phase: LocalRaidSnapshot["round"]["phase"];
  bossHp: number;
  bossMaxHp: number;
  victory: boolean;
  failed: boolean;
  battleStartsInMs?: number;
};

/** Observe displayed HP, never the unrevealed server result. Consume muted cues too. */
export class RaidGameVoiceTimeline {
  private state?: RaidGameVoiceState;
  private startsAt?: number;
  private seen = new Set<GameVoice>();

  update(state: RaidGameVoiceState | undefined, now: number) {
    const reset = state?.roomId !== this.state?.roomId
      || (state?.phase !== this.state?.phase && (state?.phase === "lobby" || state?.phase === "tutorial"))
      || Boolean(state?.failed && !this.state?.failed);
    if (reset) { this.seen.clear(); this.startsAt = undefined; }
    this.state = state;
    if (state?.battleStartsInMs !== undefined) this.startsAt = now + state.battleStartsInMs;
    else if (state && state.phase !== "lobby" && state.phase !== "tutorial") this.startsAt ??= now;
    return { reset, voice: this.tick(now) };
  }

  tick(now: number): GameVoice | undefined {
    const state = this.state;
    if (!state || state.failed || state.phase === "lobby" || state.phase === "tutorial") return;
    if (state.victory) {
      if (this.seen.has(4)) return;
      [1, 2, 3, 4].forEach(voice => this.seen.add(voice as GameVoice));
      return 4;
    }
    // The fatal hit is followed by the victory scene; do not announce low HP first.
    if (state.bossHp <= 0 || state.phase === "finished" || state.bossMaxHp <= 0) return;
    if (state.bossHp <= state.bossMaxHp / 4 && !this.seen.has(3)) {
      [1, 2, 3].forEach(voice => this.seen.add(voice as GameVoice)); return 3;
    }
    if (state.bossHp <= state.bossMaxHp / 2 && !this.seen.has(2)) {
      this.seen.add(1); this.seen.add(2); return 2;
    }
    if (this.startsAt !== undefined && now >= this.startsAt + 15_000 && !this.seen.has(1)) {
      this.seen.add(1); return 1;
    }
  }
}
