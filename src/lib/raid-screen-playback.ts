import type { LocalRaidParticipant, LocalRaidResult, LocalRaidSnapshot } from "./local-raid-types";
import type { RaidHand } from "./raid-rps";
import type { ShowcaseCue } from "./raid-showcase-scenes";

export type RaidScreenScene = {
  id: string;
  cue: ShowcaseCue;
  seconds: number;
  beforeHp: number;
  hp: number;
  maxHp: number;
  bossHand: RaidHand;
  actorId: string | null;
  amount: number;
  multiplier: number;
  counterIds: string[];
};
export type RaidScreenPlayback = {
  roomId: string;
  lastTurn: number;
  pending: LocalRaidResult[];
  active: LocalRaidResult | null;
  step: number;
  hp: number;
  maxHp: number;
  skipped: boolean;
};
export const emptyRaidPlayback: RaidScreenPlayback = { roomId: "", lastTurn: 0, pending: [], active: null, step: 0, hp: 450, maxHp: 450, skipped: false };
function steps(result: LocalRaidResult): ShowcaseCue[] {
  return ["rps", result.action === "heal" ? "heal" : result.multiplier === 2 ? "critical" : "attack",
    ...(result.counterDamage > 0 ? ["counter" as const] : []), ...(result.bossHpAfter === 0 ? ["victory" as const] : [])];
}
export function raidScreenScene(state: RaidScreenPlayback): RaidScreenScene {
  const result = state.active;
  const cue = result ? steps(result)[state.step] : state.hp === 0 ? "victory" : state.hp <= state.maxHp * .2 ? "weaken" : "idle";
  const action = result && state.step === 1;
  const hp = result ? state.step === 0 ? result.bossHpBefore : result.bossHpAfter : state.hp;
  return {
    id: `${state.roomId}:${result?.turn ?? "idle"}:${state.step}`, cue,
    seconds: cue === "rps" ? 2.7 : cue === "counter" ? 3.1 : cue === "victory" ? 4 : 2.4,
    beforeHp: action ? result.bossHpBefore : hp, hp, maxHp: state.maxHp,
    actorId: result?.participantId ?? null, bossHand: result?.boss ?? "paper",
    amount: result?.amount ?? 0, multiplier: result?.multiplier ?? 1,
    counterIds: result?.counterDamage ? [result.participantId] : [],
  };
}
export function raidPlaybackReducer(state: RaidScreenPlayback, action: { type: "snapshot"; snapshot: LocalRaidSnapshot } | { type: "complete"; id: string }): RaidScreenPlayback {
  if (action.type === "complete") {
    if (!state.active || raidScreenScene(state).id !== action.id) return state;
    if (state.step + 1 < steps(state.active).length) return { ...state, step: state.step + 1 };
    return { ...state, hp: state.active.bossHpAfter, active: state.pending[0] ?? null, pending: state.pending.slice(1), step: 0 };
  }
  const snapshot = action.snapshot;
  const lastTurn = snapshot.lastResult?.turn ?? 0;
  // Reloading skips published history, but must still play hands that waiting phones have not seen.
  if (state.roomId !== snapshot.roomId) {
    const waiting = snapshot.results.filter((result) => result.turn > snapshot.revealedTurn);
    return { ...emptyRaidPlayback, roomId: snapshot.roomId, lastTurn, hp: waiting[0]?.bossHpBefore ?? snapshot.bossHp,
      maxHp: snapshot.bossMaxHp, active: waiting[0] ?? null, pending: waiting.slice(1) };
  }
  if (lastTurn <= state.lastTurn) return state;
  const incoming = snapshot.results.filter((result) => result.turn > state.lastTurn);
  const pending = [...state.pending, ...incoming];
  // An exceptionally long disconnect/backlog catches up explicitly instead of inventing events.
  if (incoming[0]?.turn !== state.lastTurn + 1 || pending.length > 200) {
    const waiting = snapshot.results.filter((result) => result.turn > snapshot.revealedTurn);
    return { ...emptyRaidPlayback, roomId: snapshot.roomId, lastTurn, hp: waiting[0]?.bossHpBefore ?? snapshot.bossHp,
      maxHp: snapshot.bossMaxHp, active: waiting[0] ?? null, pending: waiting.slice(1), skipped: true };
  }
  return { ...state, lastTurn, skipped: false, active: state.active ?? pending[0] ?? null, pending: state.active ? pending : pending.slice(1) };
}

/** Stable slots: two users with the same character remain separate actors. */
export function raidMemberPosition(index: number, count: number) {
  const columns = Math.min(10, Math.max(1, count));
  const row = Math.floor(index / columns), column = index % columns;
  const rowCount = Math.min(columns, count - row * columns);
  return { x: (column - (rowCount - 1) / 2) * (count <= 4 ? 1.3 : .56) + (count > 4 ? .55 : 0), z: 2.55 + row * .62 };
}
export type RaidArenaContext = { members: LocalRaidParticipant[]; actorId: string | null; counterIds: string[] };
export const characterColors: Record<string, number> = { "forest-golem": 0x36c68b, "thunder-fox": 0xffb532, "flame-dragon": 0xee447a, "aqua-spirit": 0x36a5e7, "four-pro": 0xb18aff };
