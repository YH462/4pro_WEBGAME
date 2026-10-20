import { describe, expect, it } from "vitest";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";
import { emptyRaidPlayback, raidMemberPosition, raidPlaybackReducer, raidScreenScene } from "../../src/lib/raid-screen-playback";

function setup() {
  let now = 10000;
  const room = new LocalRaidRoom(() => "paper", () => now);
  room.join("one", "forest-golem", 170, "A");
  room.join("two", "forest-golem", 170, "B");
  const initial = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
  const command = (player: string, id: string, action: "attack" | "heal" = "attack") => {
    now += 1500;
    return room.command(player, { roomId: room.snapshot().roomId, requestId: id, action, hand: "scissors" });
  };
  return { room, initial, command };
}
describe("shared screen action playback", () => {
  it("queues every operation between polls, even matching request IDs from different people", () => {
    const { room, initial, command } = setup();
    const a = command("one", "same"), b = command("two", "same");
    let state = raidPlaybackReducer(initial, { type: "snapshot", snapshot: room.snapshot() });
    expect(state.active?.participantId).toBe(a.result.participantId);
    expect(state.pending[0].participantId).toBe(b.result.participantId);
    expect(a.result.participantId).not.toBe(b.result.participantId);
    expect(raidScreenScene(state)).toMatchObject({ cue: "rps", hp: 450, actorId: a.result.participantId, bossHand: "paper" });
    state = raidPlaybackReducer(state, { type: "complete", id: raidScreenScene(state).id });
    expect(raidScreenScene(state)).toMatchObject({ cue: "critical", beforeHp: 450, hp: 350, amount: 100, multiplier: 2 });
    state = raidPlaybackReducer(state, { type: "complete", id: raidScreenScene(state).id });
    expect(raidScreenScene(state)).toMatchObject({ cue: "counter", counterIds: [a.result.participantId] });
    state = raidPlaybackReducer(state, { type: "complete", id: raidScreenScene(state).id });
    expect(raidScreenScene(state)).toMatchObject({ cue: "rps", actorId: b.result.participantId, hp: 350 });
    const repeated = raidPlaybackReducer(state, { type: "snapshot", snapshot: room.snapshot() });
    expect(repeated).toBe(state);
    expect(repeated.pending).toHaveLength(0);
  });
  it("reconnects without replaying old effects and cancels the old room on reset", () => {
    const { room, initial, command } = setup();
    command("one", "a");
    const waiting = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    expect(waiting.active?.turn).toBe(1); expect(waiting.hp).toBe(450);
    room.reveal(room.snapshot().roomId, 1);
    const afterRps = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    expect(raidScreenScene(afterRps).cue).toBe("critical");
    room.impact(room.snapshot().roomId, 1, "action");
    const afterAction = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    expect(raidScreenScene(afterAction).cue).toBe("counter");
    room.impact(room.snapshot().roomId, 1, "counter");
    const reload = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    expect(reload.active).toBeNull(); expect(reload.hp).toBe(350);
    const active = raidPlaybackReducer(initial, { type: "snapshot", snapshot: room.snapshot() });
    const reset = raidPlaybackReducer(active, { type: "snapshot", snapshot: room.reset() });
    expect(reset).toMatchObject({ active: null, pending: [], hp: 450 });
    expect(raidPlaybackReducer(reset, { type: "complete", id: raidScreenScene(active).id })).toBe(reset);
  });
  it("shows actual self-healing and capped lethal damage before victory", () => {
    const { room, initial, command } = setup();
    command("one", "attack"); const heal = command("one", "heal", "heal");
    let state = raidPlaybackReducer(initial, { type: "snapshot", snapshot: room.snapshot() });
    for (let i = 0; i < 4; i++) state = raidPlaybackReducer(state, { type: "complete", id: raidScreenScene(state).id });
    expect(raidScreenScene(state)).toMatchObject({ cue: "heal", amount: heal.result.amount, actorId: heal.result.participantId });
    for (let i = 0; i < 4; i++) command(i % 2 ? "two" : "one", `kill-${i}`);
    room.reveal(room.snapshot().roomId, room.snapshot().lastResult!.turn);
    room.impact(room.snapshot().roomId, room.snapshot().lastResult!.turn, "action");
    const loaded = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    expect(raidScreenScene(loaded)).toMatchObject({ cue: "victory", hp: 0 });
  });
  it("lays out twenty separate slots within the stage", () => {
    const positions = Array.from({ length: 20 }, (_, i) => raidMemberPosition(i, 20));
    expect(new Set(positions.map((point) => `${point.x}:${point.z}`)).size).toBe(20);
    expect(positions.every((point) => Math.abs(point.x) < 3.2 && point.z < 3.5)).toBe(true);
  });
  it("reports a history gap and catches up after a long disconnect", () => {
    let now = 0;
    const room = new LocalRaidRoom(() => "paper", () => now);
    room.join("a", "forest-golem", 100000, "A");
    const state = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    for (let i = 0; i < 205; i++) {
      now += 1500;
      room.command("a", { roomId: room.snapshot().roomId, requestId: `heal-${i}`, action: "heal", hand: "paper" });
    }
    expect(room.snapshot().results).toHaveLength(200);
    const resumed = raidPlaybackReducer(state, { type: "snapshot", snapshot: room.snapshot() });
    expect(resumed).toMatchObject({ skipped: true, hp: 450, active: { turn: 6 } });
    expect(resumed.pending).toHaveLength(199);
  });
});
