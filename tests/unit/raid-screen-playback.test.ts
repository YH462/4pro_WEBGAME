import { describe, expect, it } from "vitest";
import { LocalRaidRoom, raidTutorialMs } from "../../src/lib/local-raid-room";
import { emptyRaidPlayback, raidMemberPosition, raidPlaybackReducer, raidScreenIsLast, raidScreenScene } from "../../src/lib/raid-screen-playback";
function setup() {
  let now = 0; const room = new LocalRaidRoom(() => "paper", () => now);
  room.join("a", "forest-golem", 170, "A"); room.join("b", "forest-golem", 170, "B");
  const roomId = room.snapshot().roomId; room.start(roomId); now += raidTutorialMs; room.snapshot();
  for (const [player, hand] of [["a", "paper"], ["b", "scissors"]] as const) room.command(player, { roomId, round: 1, requestId: player, action: "attack", hand });
  now += 10000; room.snapshot(); return { room, roomId };
}
describe("shared round playback", () => {
  it("uses one RPS and one combined action for all participants, then one team counter", () => {
    const { room } = setup();
    let state = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    expect(raidScreenScene(state)).toMatchObject({ cue: "rps", actorId: null, hp: 900 });
    state = raidPlaybackReducer(state, { type: "complete", id: raidScreenScene(state).id });
    const scene = raidScreenScene(state); expect(scene).toMatchObject({ cue: "critical", hp: 750, amount: 150 });
    expect(scene.actions).toHaveLength(2); expect(new Set(scene.actions.map((action) => action.participantId)).size).toBe(2);
    state = raidPlaybackReducer(state, { type: "complete", id: scene.id });
    expect(raidScreenScene(state).cue).toBe("counter"); expect(raidScreenScene(state).counterIds).toHaveLength(2); expect(raidScreenIsLast(state)).toBe(true);
    state = raidPlaybackReducer(state, { type: "complete", id: raidScreenScene(state).id }); expect(state.active).toBeNull();
    expect(raidPlaybackReducer(state, { type: "snapshot", snapshot: room.snapshot() })).toBe(state);
  });
  it("resumes after each published checkpoint without replaying RPS and cancels on reset", () => {
    const { room, roomId } = setup(); room.reveal(roomId, 1);
    let state = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() }); expect(raidScreenScene(state).cue).toBe("critical");
    room.impact(roomId, 1, "action"); state = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() }); expect(raidScreenScene(state).cue).toBe("counter");
    const reset = raidPlaybackReducer(state, { type: "snapshot", snapshot: room.reset() }); expect(reset).toMatchObject({ active: null, hp: 450 });
    expect(raidPlaybackReducer(reset, { type: "complete", id: raidScreenScene(state).id })).toBe(reset);
  });
  it("keeps twenty stable separate positions", () => {
    const slots = Array.from({ length: 20 }, (_, i) => raidMemberPosition(i, 20));
    expect(new Set(slots.map(({ x, z }) => `${x}:${z}`)).size).toBe(20);
    expect(slots.every(({ x, z }) => Math.abs(x) < 3.2 && z < 3.5)).toBe(true);
  });
  it("updates waiting HP and capacity when players join without replaying an animation", () => {
    const room = new LocalRaidRoom(); room.join("a", "forest-golem", 170, "A");
    const before = raidPlaybackReducer(emptyRaidPlayback, { type: "snapshot", snapshot: room.snapshot() });
    for (let i = 1; i < 10; i++) room.join(`p${i}`, "forest-golem", 170, `P${i}`);
    const after = raidPlaybackReducer(before, { type: "snapshot", snapshot: room.snapshot() });
    expect(raidScreenScene(after)).toMatchObject({ cue: "idle", hp: 4500, maxHp: 4500 });
    expect(after.active).toBeNull(); expect(after.roomId).toBe(before.roomId);
    expect(raidPlaybackReducer(after, { type: "snapshot", snapshot: room.snapshot() })).toBe(after);
  });
});
