import { describe, expect, it } from "vitest";
import { LocalRaidRoom, raidTutorialMs } from "../../src/lib/local-raid-room";
import { startDestination } from "../../src/lib/acquisition-links";

describe("persistent raid rules", () => {
  it("restores an in-progress input round, duplicate receipts and character HP across processes", () => {
    let now = 0;
    const original = new LocalRaidRoom(() => "paper", () => now);
    original.join("player", "forest-golem", 170, "参加者");
    const roomId = original.snapshot().roomId;
    original.start(roomId); now += raidTutorialMs; original.snapshot();
    const command = { roomId, round: 1, requestId: "same", action: "attack" as const, hand: "scissors" as const };
    original.command("player", command);
    const saved = JSON.parse(JSON.stringify(original.save()));
    const restored = LocalRaidRoom.restore(saved, () => now);
    expect(restored.snapshot("player")).toEqual(original.snapshot("player"));
    expect(restored.command("player", command).state.round.submitted).toBe(1);
    expect(() => restored.command("player", { ...command, hand: "rock" })).toThrow("同じ送信ID");
    now = raidTutorialMs + 10_000;
    const afterDeadline = restored.snapshot("player");
    expect(afterDeadline.round.phase).toBe("playing");
    const replay = LocalRaidRoom.restore(JSON.parse(JSON.stringify(restored.save())), () => now);
    expect(replay.snapshot("player")).toEqual(afterDeadline);
    replay.reveal(roomId, 1); replay.impact(roomId, 1, "action"); replay.impact(roomId, 1, "counter"); replay.finish(roomId, 1);
    const resumed = LocalRaidRoom.restore(replay.save(), () => now);
    expect(resumed.snapshot("player")).toMatchObject({ round: { number: 2, phase: "collecting" }, me: { hp: 158 } });
    resumed.finish(roomId, 1);
    expect(resumed.snapshot().round.number).toBe(2);
    expect(original.save().revealedTurn).toBe(0);
  });

  it("returns new visitors to the production raid after guest entry", () => {
    expect(startDestination({ next: "raid" })).toBe("/battle/raid");
    expect(startDestination({ next: ["raid"] })).toBe("/");
  });

  it("does not add late visitors or change a participant after the battle has finished", () => {
    let now = 0;
    const room = new LocalRaidRoom(() => "paper", () => now);
    for (let i = 0; i < 5; i++) room.join(`player-${i}`, "forest-golem", 170, `参加者${i}`);
    const roomId = room.snapshot().roomId;
    room.start(roomId); now += raidTutorialMs; room.snapshot();
    for (let turn = 1; turn <= 5; turn++) {
      for (let i = 0; i < 5; i++) room.command(`player-${i}`, { roomId, round: turn, requestId: `${turn}-p${i}`, action: "attack", hand: "scissors" });
      now += 10_000; room.snapshot(); room.finish(roomId, turn);
    }
    expect(room.snapshot().round.phase).toBe("finished");
    expect(() => room.join("late", "forest-golem", 170, "後から参加")).toThrow("終了したレイド");
    expect(room.join("player-0", "four-pro", 300, "変更後").me?.characterId).toBe("forest-golem");
    expect(room.snapshot().participants).toBe(5);
  });
});
