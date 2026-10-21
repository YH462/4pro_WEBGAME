import { describe, expect, it, vi } from "vitest";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";
import { visibleLocalRaid } from "../../src/lib/local-raid-presentation";
function setup() {
  let now = 0;
  const room = new LocalRaidRoom(() => "paper", () => now);
  room.join("a", "forest-golem", 170, "A"); room.join("b", "forest-golem", 170, "B");
  const roomId = room.snapshot().roomId; room.start(roomId);
  const command = (action: "attack" | "heal" = "attack") => room.command("a", { roomId, round: room.snapshot().round.number, requestId: `r-${room.snapshot().round.number}`, action, hand: "scissors" });
  return { room, roomId, command, close: () => { now += 10000; return room.snapshot(); } };
}
describe("round-wide presentation checkpoints", () => {
  it("reveals everyone's outcome together but waits for action and counter contacts for HP", () => {
    const { room, roomId, command, close } = setup(); command(); close();
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 450, me: { hp: 170, lastResult: null } });
    room.reveal(roomId, 1);
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 450, me: { hp: 170, lastResult: { label: "勝ち" } } });
    room.impact(roomId, 1, "action"); expect(visibleLocalRaid(room.snapshot("a")).bossHp).toBe(350);
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(170);
    room.impact(roomId, 1, "counter");
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(150);
    expect(visibleLocalRaid(room.snapshot("b")).me?.hp).toBe(150);
  });
  it("shows healing before a simultaneous team counter", () => {
    const { room, roomId, command, close } = setup(); command(); close(); room.finish(roomId, 1);
    command("heal"); close(); room.reveal(roomId, 2);
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(150);
    room.impact(roomId, 2, "action"); expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(170);
    room.impact(roomId, 2, "counter"); expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(150);
  });
  it("wakes long polls at each checkpoint, deduplicates acknowledgements and cancels on reset", async () => {
    const { room, roomId, command, close } = setup(); command(); close();
    const changed = vi.fn(); const waiting = room.waitForRevision(roomId, room.snapshot().revision).then(changed);
    await Promise.resolve(); expect(changed).not.toHaveBeenCalled(); room.reveal(roomId, 1); await waiting;
    expect(changed).toHaveBeenCalledOnce(); const revision = room.snapshot().revision;
    room.reveal(roomId, 1); expect(room.snapshot().revision).toBe(revision);
    const aborted = new AbortController(); const poll = room.waitForRevision(roomId, revision, aborted.signal); aborted.abort(); await poll;
    const reset = room.waitForRevision(roomId, revision); room.reset(); await reset;
    expect(() => room.impact(roomId, 1, "counter")).toThrow("リセット");
  });
});
