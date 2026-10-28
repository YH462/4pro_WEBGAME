import { describe, expect, it, vi } from "vitest";
import { allocateRaidDamage, LocalRaidRoom } from "../../src/lib/local-raid-room";
import { privateIpv4 } from "../../src/lib/local-network";

function setup(count = 3) {
  let now = 10000;
  const draw = vi.fn(() => "paper" as const), room = new LocalRaidRoom(draw, () => now);
  for (let i = 0; i < count; i++) room.join(`p${i}`, "forest-golem", 170, `P${i}`);
  const roomId = room.snapshot().roomId;
  const send = (i: number, hand: "rock" | "paper" | "scissors", action: "attack" | "heal" = "attack", id = `r${room.snapshot().round.number}-p${i}`) => room.command(`p${i}`, { roomId, round: room.snapshot().round.number, requestId: id, action, hand });
  return { room, roomId, draw, send, advance: (ms = 10000) => { now += ms; return room.snapshot(); } };
}
describe("shared ten-second raid rounds", () => {
  it("waits for the common deadline then draws once for different personal outcomes", () => {
    const { room, roomId, draw, send, advance } = setup();
    expect(room.snapshot().round.phase).toBe("lobby"); room.start(roomId);
    send(0, "scissors"); send(1, "paper"); send(2, "rock");
    expect(draw).not.toHaveBeenCalled();
    expect(advance(9999)).toMatchObject({ bossHp: 1350, results: [], round: { phase: "collecting", submitted: 3 } });
    const state = advance(1);
    expect(draw).toHaveBeenCalledOnce(); expect(state.round.phase).toBe("playing");
    expect(state.results.map((result) => result.boss)).toEqual(["paper", "paper", "paper"]);
    expect(state.results.map((result) => result.multiplier)).toEqual([2, 1, .5]);
    expect(state.results.map((result) => result.amount)).toEqual([100, 50, 25]);
    expect(state.bossHp).toBe(1175); expect(state.results.every((result) => result.turn === 1)).toBe(true);
    expect(state.members.map((member) => member.hp)).toEqual([157, 157, 157]);
    room.snapshot(); expect(draw).toHaveBeenCalledOnce();
  });
  it("accepts one command per person, deduplicates retries and rejects payload changes", () => {
    const { room, roomId, send, advance } = setup(); room.start(roomId);
    send(0, "rock", "attack", "same"); send(0, "rock", "attack", "same");
    expect(room.snapshot().round.submitted).toBe(1);
    expect(() => send(0, "paper", "attack", "same")).toThrow("同じ送信ID");
    expect(() => send(0, "rock", "attack", "new")).toThrow("送信済み");
    send(1, "paper", "attack", "same"); expect(room.snapshot().round.submitted).toBe(2);
    advance(); send(0, "rock", "attack", "same"); expect(room.snapshot().results).toHaveLength(3);
    expect(() => send(2, "rock")).toThrow("受付は終了");
  });
  it("rejects a command arriving exactly at the deadline and rejects stale rounds", () => {
    const { room, roomId, send, advance } = setup(); room.start(roomId); advance();
    expect(() => send(0, "scissors")).toThrow("受付は終了");
    room.finish(roomId, 1);
    expect(room.snapshot().round).toMatchObject({ number: 2, phase: "collecting" });
    expect(() => room.command("p0", { roomId, round: 1, requestId: "late", hand: "paper", action: "attack" })).toThrow("受付は終了");
    const deadline = room.snapshot().round.closesAt;
    room.finish(roomId, 1); expect(room.snapshot().round.closesAt).toBe(deadline);
  });
  it("skips non-submitted actions, counters once and refuses mid-battle visitors", () => {
    const { room, roomId, send, advance } = setup(2); room.start(roomId); send(0, "scissors");
    advance(); expect(() => room.join("late", "aqua-spirit", 135, "LATE")).toThrow("バトル開始後");
    expect(room.snapshot("p1").me?.lastResult).toMatchObject({ submitted: false, amount: 0, counterDamage: 12 });
    expect(room.snapshot("late").me).toBeNull();
    room.finish(roomId, 1); advance();
    expect(() => room.join("late", "aqua-spirit", 135, "LATE")).toThrow("バトル開始後");
    expect(room.snapshot("p1").me?.lastResult).toMatchObject({ turn: 2, submitted: false, counterDamage: 12 });
  });
  it("caps self-healing then counters everyone once and preserves rejoin HP", () => {
    const { room, roomId, send, advance } = setup(2); room.start(roomId); send(0, "scissors"); advance(); room.finish(roomId, 1);
    send(0, "scissors", "heal"); advance();
    expect(room.snapshot("p0").me?.lastResult).toMatchObject({ amount: 12, playerHpBefore: 158, playerHpAfter: 158 });
    expect(room.snapshot("p1").me?.hp).toBe(146);
    room.join("p0", "forest-golem", 170, "P0"); expect(room.snapshot("p0").me?.hp).toBe(158);
    expect(() => room.join("p0", "aqua-spirit", 135, "P0")).toThrow("キャラクター変更");
  });
  it("apportions lethal damage across all attackers and cancels the counter on victory", () => {
    expect(allocateRaidDamage([100, 50, 25], 50)).toEqual([29, 14, 7]);
    const { room, roomId, send, advance } = setup(6); room.start(roomId);
    for (let turn = 0; turn < 4; turn++) {
      for (let i = 0; i < 6; i++) send(i, "scissors");
      advance(); room.finish(roomId, turn + 1);
    }
    for (let i = 0; i < 6; i++) send(i, "scissors");
    const state = advance();
    expect(state.bossHp).toBe(0); expect(state.rounds.at(-1)!.results.map((result) => result.amount)).toEqual(Array(6).fill(50));
    expect(state.rounds.at(-1)!.results.every((result) => result.counterDamage === 0)).toBe(true);
    room.finish(roomId, 5); expect(room.snapshot().round.phase).toBe("finished");
  });
  it("resets every pending intent, rejects old room IDs and enforces the cap", () => {
    const { room, roomId, send } = setup(20);
    expect(() => room.join("overflow", "forest-golem", 170, "OVER")).toThrow("20人");
    room.start(roomId); send(0, "rock");
    expect(() => room.join("bad", "a", NaN, "bad")).toThrow();
    const state = room.reset(); expect(state).toMatchObject({ participants: 0, rounds: [], results: [], round: { number: 0, phase: "lobby" } });
    expect(() => room.start(roomId)).toThrow("リセット");
  });
  it("requires a living participant to start and stops after a team wipe", () => {
    let now = 0; const room = new LocalRaidRoom(() => "paper", () => now);
    const roomId = room.snapshot().roomId;
    expect(() => room.start(roomId)).toThrow("参加者");
    room.join("a", "forest-golem", 10, "A"); room.start(roomId);
    now = 10000;
    expect(room.snapshot("a").me?.lastResult).toMatchObject({ submitted: false, counterDamage: 10, playerHpAfter: 0 });
    room.finish(roomId, 1);
    expect(room.snapshot()).toMatchObject({ alive: 0, round: { phase: "finished", closesAt: null } });
    expect(() => room.command("a", { roomId, round: 2, requestId: "after-wipe", action: "attack", hand: "rock" })).toThrow("受付は終了");
  });
  it("returns detached intents, results and batches", () => {
    const { room, roomId, send, advance } = setup(1); room.start(roomId); send(0, "scissors");
    room.snapshot("p0").me!.submission!.hand = "rock";
    advance(); const state = room.snapshot("p0"); state.rounds[0].results[0].amount = 999; state.results[0].amount = 999;
    expect(room.snapshot().results[0].amount).toBe(100);
    expect(room.snapshot().results[0].hand).toBe("scissors");
  });
});
describe("LAN addresses", () => {
  it.each(["10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.1.2"])("recognizes %s", (host) => expect(privateIpv4(host)).toBe(true));
  it.each(["8.8.8.8", "172.15.1.1", "172.32.1.1", "127.0.0.1", "192.168.1.999", "evil.example"])("excludes %s", (host) => expect(privateIpv4(host)).toBe(false));
});
