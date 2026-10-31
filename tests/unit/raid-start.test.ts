import { describe, expect, it, vi } from "vitest";
import { LocalRaidRoom, raidTutorialMs, raidLateJoinMs } from "../../src/lib/local-raid-room";
import { raidAdmissionOpen } from "../../src/lib/raid-admission";
import { visibleLocalRaid } from "../../src/lib/local-raid-presentation";

function setup() {
  let now = 1000;
  const draw = vi.fn(() => "paper" as const);
  const room = new LocalRaidRoom(draw, () => now);
  room.join("host", "forest-golem", 170, "HOST");
  const roomId = room.snapshot().roomId;
  const command = (playerId = "host", round = 1) => room.command(playerId, { roomId, round, requestId: `${playerId}-${round}`, hand: "scissors", action: "attack" });
  const advance = (ms: number) => { now += ms; return room.snapshot(); };
  return { room, roomId, draw, command, advance, clock: () => now };
}

describe("explanation and late admission", () => {
  it("shows rules for the full opening voice, rejects early commands and starts the first ten-second window automatically", () => {
    const { room, roomId, advance, command, draw } = setup();
    expect(room.start(roomId)).toMatchObject({ admissionClosesAt: 80_000, round: { phase: "tutorial", number: 0, closesAt: 50_000 } });
    expect(() => command()).toThrow("受付は終了");
    const before = advance(raidTutorialMs - 1);
    expect(before.round.phase).toBe("tutorial"); expect(raidAdmissionOpen(before)).toBe(true);
    expect(room.start(roomId).round.closesAt).toBe(50_000);
    expect(advance(1).round).toMatchObject({ phase: "collecting", number: 1, closesAt: 60_000 });
    command(); expect(draw).not.toHaveBeenCalled(); expect(advance(9999).round.submitted).toBe(1);
    expect(advance(1).round.phase).toBe("playing"); expect(draw).toHaveBeenCalledOnce();
  });

  it("persists both deadlines through reload and handles an overdue explanation without extending admission", () => {
    const { room, roomId, advance, clock } = setup(); room.start(roomId); advance(20_000);
    const restored = LocalRaidRoom.restore(JSON.parse(JSON.stringify(room.save())), clock);
    expect(restored.snapshot()).toEqual(room.snapshot());
    advance(raidTutorialMs - 20_000 + 15_000);
    expect(restored.snapshot()).toMatchObject({ admissionClosesAt: 80_000, round: { phase: "playing", number: 1, closesAt: 60_000 } });
    expect(restored.snapshot().results).toHaveLength(1);
    advance(15_000); expect(raidAdmissionOpen(restored.snapshot())).toBe(false);
    expect(() => restored.join("late", "forest-golem", 170, "LATE")).toThrow("受付は終了");
  });

  it("admits an explanation arrival and an input-window arrival into the first round", () => {
    const { room, roomId, advance, command } = setup(); room.start(roomId);
    expect(room.join("tutorial", "forest-golem", 170, "TUTORIAL").me?.eligibleRound).toBe(1);
    advance(raidTutorialMs);
    expect(room.join("input", "forest-golem", 170, "INPUT")).toMatchObject({ bossHp: 1350, round: { eligible: 3 }, me: { eligibleRound: 1 } });
    command("tutorial"); command("input");
    expect(advance(10_000).results.map(result => result.nickname)).toEqual(["HOST", "TUTORIAL", "INPUT"]);
  });

  it("queues animation arrivals for the next round without changing existing results or applying a past counter", () => {
    const { room, roomId, advance, command } = setup(); room.start(roomId); advance(raidTutorialMs); command(); advance(10_000);
    const before = room.snapshot();
    expect(room.join("late", "aqua-spirit", 135, "LATE")).toMatchObject({ bossHp: before.bossHp, bossMaxHp: before.bossMaxHp, round: { eligible: 1 }, me: { hp: 135, eligibleRound: 2, lastResult: null } });
    expect(room.snapshot().rounds).toEqual(before.rounds);
    expect(() => command("late")).toThrow("受付は終了");
    room.impact(roomId, 1, "counter");
    expect(visibleLocalRaid(room.snapshot("late")).me?.hp).toBe(135);
    room.finish(roomId, 1);
    expect(room.snapshot()).toMatchObject({ bossHp: 800, bossMaxHp: 900, totalDamage: 100, round: { eligible: 2 } });
    command("late", 2); expect(room.snapshot().round.submitted).toBe(1);
  });

  it("accepts at 29.999 seconds and rejects at 30 seconds into battle while reconnects retain their HP", () => {
    const { room, roomId, advance } = setup(); room.start(roomId); advance(raidTutorialMs + raidLateJoinMs - 1);
    expect(raidAdmissionOpen(room.snapshot())).toBe(true);
    expect(room.join("last", "forest-golem", 170, "LAST").participants).toBe(2);
    advance(1); expect(raidAdmissionOpen(room.snapshot())).toBe(false);
    expect(() => room.join("closed", "forest-golem", 170, "CLOSED")).toThrow("受付は終了");
    const hp = room.snapshot("host").me!.hp;
    expect(room.join("host", "forest-golem", 170, "HOST").me!.hp).toBe(hp);
  });

  it("keeps the cap, removed-player restrictions and resets the deadlines for the next battle", () => {
    const { room, roomId } = setup(); room.join("removed", "forest-golem", 170, "REMOVED");
    room.remove(roomId, room.snapshot().members[1].id); room.start(roomId);
    expect(() => room.join("removed", "forest-golem", 170, "REMOVED")).toThrow("解除");
    for (let i = 0; i < 19; i++) room.join(`p${i}`, "forest-golem", 170, `P${i}`);
    expect(() => room.join("overflow", "forest-golem", 170, "FULL")).toThrow("20人");
    expect(room.reset()).toMatchObject({ admissionClosesAt: null, round: { phase: "lobby", closesAt: null } });
    expect(() => room.start(roomId)).toThrow("リセット");
  });

  it("closes on victory or team wipe even before the grace period expires, and leaves old running saves closed", () => {
    const { room, roomId, advance, clock } = setup(); room.start(roomId); advance(raidTutorialMs);
    const legacy = room.save(); delete legacy.admissionClosesAt;
    const restored = LocalRaidRoom.restore(legacy, clock);
    expect(raidAdmissionOpen(restored.snapshot())).toBe(false);
    expect(() => restored.join("new", "forest-golem", 170, "NEW")).toThrow("受付は終了");
    for (const change of [{ bossHp: 0 }, { members: room.save().members.map(([id, member]) => [id, { ...member, hp: 0 }] as typeof legacy.members[number]) }]) {
      const ended = LocalRaidRoom.restore({ ...room.save(), ...change }, clock);
      expect(raidAdmissionOpen(ended.snapshot())).toBe(false);
      expect(() => ended.join("new", "forest-golem", 170, "NEW")).toThrow("受付は終了");
    }
  });
});
