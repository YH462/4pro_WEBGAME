import type { LocalRaidParticipant, LocalRaidRoundResult, LocalRaidSnapshot } from "./local-raid-types";
import type { RaidHand } from "./raid-rps";
import type { ShowcaseCue } from "./raid-showcase-scenes";

export type RaidArenaAction = { participantId: string; action: "attack" | "heal"; multiplier: number; amount: number };
export type RaidScreenScene = {
  id: string; cue: ShowcaseCue; seconds: number; beforeHp: number; hp: number; maxHp: number;
  bossHand: RaidHand; actorId: string | null; amount: number; multiplier: number; counterIds: string[]; actions: RaidArenaAction[];
};
export type RaidScreenPlayback = {
  roomId: string; lastTurn: number; active: LocalRaidRoundResult | null; step: number; hp: number; maxHp: number; skipped: boolean;
};
export const emptyRaidPlayback: RaidScreenPlayback = { roomId: "", lastTurn: 0, active: null, step: 0, hp: 450, maxHp: 450, skipped: false };
function steps(round: LocalRaidRoundResult): ShowcaseCue[] {
  const attacks = round.results.filter((result) => result.submitted && result.action === "attack");
  const action: ShowcaseCue = attacks.length ? attacks.some((result) => result.multiplier === 2) ? "critical" : "attack" : round.results.some((result) => result.submitted && result.action === "heal") ? "heal" : "idle";
  return ["rps", action, ...(round.results.some((result) => result.counterDamage > 0) ? ["counter" as const] : []), ...(round.bossHpAfter === 0 ? ["victory" as const] : [])];
}
export function raidScreenIsLast(state: RaidScreenPlayback) { return Boolean(state.active && state.step === steps(state.active).length - 1); }
export function raidScreenScene(state: RaidScreenPlayback): RaidScreenScene {
  const round = state.active;
  const cue = round ? steps(round)[state.step] : state.hp === 0 ? "victory" : "idle";
  const hp = round ? state.step === 0 ? round.bossHpBefore : round.bossHpAfter : state.hp;
  const actions = round?.results.filter((result) => result.submitted).map(({ participantId, action, multiplier, amount }) => ({ participantId, action, multiplier, amount })) ?? [];
  return {
    id: `${state.roomId}:${round?.turn ?? "idle"}:${state.step}`, cue,
    seconds: cue === "rps" ? 2.7 : cue === "counter" ? 3.1 : cue === "victory" ? 4 : 2.4,
    beforeHp: round && state.step === 1 ? round.bossHpBefore : hp, hp, maxHp: state.maxHp,
    actorId: actions.length === 1 ? actions[0].participantId : null, bossHand: round?.boss ?? "paper",
    amount: cue === "heal" ? round?.healing ?? 0 : round?.damage ?? 0, multiplier: cue === "critical" ? 2 : 1,
    counterIds: round?.results.filter((result) => result.counterDamage > 0).map((result) => result.participantId) ?? [], actions,
  };
}
export function raidPlaybackReducer(state: RaidScreenPlayback, action: { type: "snapshot"; snapshot: LocalRaidSnapshot } | { type: "complete"; id: string }): RaidScreenPlayback {
  if (action.type === "complete") {
    if (!state.active || raidScreenScene(state).id !== action.id) return state;
    if (!raidScreenIsLast(state)) return { ...state, step: state.step + 1 };
    return { ...state, hp: state.active.bossHpAfter, active: null, step: 0 };
  }
  const snapshot = action.snapshot;
  const round = snapshot.round.phase === "playing" ? snapshot.rounds.at(-1) ?? null : null;
  if (state.roomId === snapshot.roomId && (!round || round.turn <= state.lastTurn)) {
    // Joining while waiting/collecting can increase capacity without starting
    // another animation. Keep the idle HP bar in sync with the server.
    if (!state.active && (state.hp !== snapshot.bossHp || state.maxHp !== snapshot.bossMaxHp)) return { ...state, hp: snapshot.bossHp, maxHp: snapshot.bossMaxHp };
    return state;
  }
  const requestedStep = !round || round.turn > snapshot.revealedTurn ? 0 : round.turn > snapshot.actionTurn ? 1 : 2;
  const step = round ? Math.min(requestedStep, steps(round).length - 1) : 0;
  return { ...emptyRaidPlayback, roomId: snapshot.roomId, lastTurn: round?.turn ?? 0, active: round, step,
    hp: round ? step === 0 ? round.bossHpBefore : round.bossHpAfter : snapshot.bossHp, maxHp: snapshot.bossMaxHp };
}
/** Stable slots: two users with the same character remain separate actors. */
export function raidMemberPosition(index: number, count: number) {
  const columns = Math.min(10, Math.max(1, count));
  const row = Math.floor(index / columns), column = index % columns;
  const rowCount = Math.min(columns, count - row * columns);
  return { x: (column - (rowCount - 1) / 2) * (count <= 4 ? 1.3 : .56) + (count > 4 ? .55 : 0), z: 2.55 + row * .62 };
}
export type RaidArenaContext = { members: LocalRaidParticipant[]; actorId: string | null; counterIds: string[]; actions?: RaidArenaAction[] };
export const characterColors: Record<string, number> = { "forest-golem": 0x36c68b, "thunder-fox": 0xffb532, "flame-dragon": 0xee447a, "aqua-spirit": 0x36a5e7, "four-pro": 0xb18aff };
