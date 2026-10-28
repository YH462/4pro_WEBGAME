import { describe, expect, it } from "vitest";
import { raidBalance } from "../../src/lib/raid-balance";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";

function team(count: number, hp = 170) {
  let now = 0;
  const room = new LocalRaidRoom(() => "paper", () => now);
  for (let i = 0; i < count; i++) room.join(`p${i}`, "forest-golem", hp, `P${i}`);
  const roomId = room.snapshot().roomId;
  return { room, roomId, close: () => { now += 10_000; return room.snapshot(); } };
}
function attack(room: LocalRaidRoom, roomId: string, count: number) {
  const round = room.snapshot().round.number;
  for (let i = 0; i < count; i++) room.command(`p${i}`, { roomId, round, requestId: `${round}-${i}`, action: "attack", hand: "scissors" });
}

describe("participant-scaled raid balance", () => {
  it("uses the ten-player tuning baseline and caps strength at the twenty-player limit", () => {
    expect(raidBalance(10)).toMatchObject({ maxHp: 4500, attack: 14 });
    expect(raidBalance(20)).toMatchObject({ maxHp: 9000, attack: 17 });
    expect(raidBalance(100)).toEqual(raidBalance(20));
    expect(raidBalance(0)).toMatchObject({ maxHp: 450, attack: 12 });
    for (let n = 1; n < 20; n++) {
      expect(raidBalance(n + 1).maxHp).toBeGreaterThanOrEqual(raidBalance(n).maxHp);
      expect(raidBalance(n + 1).attack).toBeGreaterThanOrEqual(raidBalance(n).attack);
    }
  });
  it.each([1, 2, 5, 10, 20])("cannot be defeated in one round even if all %i players win", count => {
    const { room, roomId, close } = team(count); room.start(roomId); attack(room, roomId, count);
    const state = close();
    expect(state.bossHp).toBeGreaterThan(0);
    expect(state.bossHp).toBe(state.bossMaxHp - count * 100);
    expect(state.results.every(result => result.counterDamage === state.bossAttack)).toBe(true);
  });
  it.each([10, 20])("targets eight to ten turns on average for a mixed-HP %i-player group using recovery", count => {
    let seed = 1729, totalTurns = 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const hands = ["rock", "paper", "scissors"] as const;
    const characterHp = [170, 125, 120, 135, 155, 145, 130, 180, 115, 155, 140];
    for (let trial = 0; trial < 120; trial++) {
      let now = 0;
      const room = new LocalRaidRoom(() => hands[Math.floor(random() * 3)], () => now);
      for (let i = 0; i < count; i++) room.join(`p${i}`, "forest-golem", characterHp[i % characterHp.length], `P${i}`);
      const roomId = room.snapshot().roomId; room.start(roomId);
      for (let turn = 1; turn <= 30 && room.snapshot().round.phase !== "finished"; turn++) {
        const state = room.snapshot();
        for (let i = 0; i < count; i++) {
          const member = state.members[i]; if (member.hp <= 0) continue;
          room.command(`p${i}`, { roomId, round: turn, requestId: `${turn}-${i}`, action: member.hp <= state.bossAttack * 2 ? "heal" : "attack", hand: hands[Math.floor(random() * 3)] });
        }
        now += 10_000; room.snapshot(); room.finish(roomId, turn);
      }
      const end = room.snapshot();
      expect(end.bossHp).toBe(0); expect(end.totalDamage).toBe(end.bossMaxHp);
      totalTurns += end.turn;
    }
    const average = totalTurns / 120;
    expect(average).toBeGreaterThanOrEqual(8); expect(average).toBeLessThanOrEqual(10);
  });
  it("scales waiting arrivals and ignores reconnects and character swaps", () => {
    const { room } = team(2);
    const before = room.snapshot();
    for (let i = 2; i < 10; i++) room.join(`p${i}`, "forest-golem", 170, `P${i}`);
    const scaled = room.snapshot();
    expect(scaled).toMatchObject({ bossMaxHp: 4500, bossHp: 4500, bossAttack: 14, difficultyPlayers: 10, totalDamage: 0 });
    expect(scaled.bossHp - before.bossHp).toBe(scaled.bossMaxHp - before.bossMaxHp);
    room.join("p0", "forest-golem", 170, "P0"); room.join("p0", "aqua-spirit", 135, "P0");
    expect(room.snapshot()).toMatchObject({ bossMaxHp: 4500, bossHp: 4500, bossAttack: 14, difficultyPlayers: 10 });
  });
  it("rejects mid-animation and subsequent-round arrivals and preserves strength across reload", () => {
    const { room, roomId, close } = team(2); room.start(roomId); attack(room, roomId, 2); close();
    for (let i = 2; i < 10; i++) expect(() => room.join(`p${i}`, "forest-golem", 170, `P${i}`)).toThrow("バトル開始後");
    expect(room.snapshot()).toMatchObject({ bossMaxHp: 900, bossHp: 700, bossAttack: 12, difficultyPlayers: 2 });
    expect(room.snapshot("p9").me).toBeNull();
    room.finish(roomId, 1);
    const reloaded = LocalRaidRoom.restore(JSON.parse(JSON.stringify(room.save())), () => 10_000);
    expect(reloaded.snapshot()).toMatchObject({ bossMaxHp: 900, bossHp: 700, bossAttack: 12, difficultyPlayers: 2 });
    expect(() => reloaded.join("p9", "forest-golem", 170, "P9")).toThrow("バトル開始後");
    expect(reloaded.snapshot().members.map(member => member.hp)).toEqual(room.snapshot().members.map(member => member.hp));
  });
  it("does not weaken the boss as allies are knocked out", () => {
    const { room, roomId, close } = team(9, 10); room.join("p9", "forest-golem", 170, "P9"); room.start(roomId);
    close(); room.finish(roomId, 1);
    expect(room.snapshot()).toMatchObject({ alive: 1, bossMaxHp: 4500, bossAttack: 14, difficultyPlayers: 10 });
  });
  it("keeps a legacy running fight unchanged, then enables scaling after reset or for an unstarted lobby", () => {
    const { room, roomId } = team(10); room.start(roomId);
    const legacy = room.save(); delete legacy.balance; legacy.bossHp = 450;
    let legacyNow = 0;
    const restored = LocalRaidRoom.restore(legacy, () => legacyNow);
    expect(restored.snapshot()).toMatchObject({ bossMaxHp: 450, bossHp: 450, bossAttack: 20, difficultyPlayers: 0 });
    legacyNow = 10_000;
    expect(restored.snapshot().results.every(result => result.counterDamage === 20)).toBe(true);
    restored.reset(); for (let i = 0; i < 10; i++) restored.join(`p${i}`, "forest-golem", 170, `P${i}`);
    expect(restored.snapshot()).toMatchObject({ bossMaxHp: 4500, bossAttack: 14 });
    const waiting = room.save(); delete waiting.balance; waiting.phase = "lobby"; waiting.turn = 0; waiting.bossHp = 450;
    const lobby = LocalRaidRoom.restore(waiting); lobby.start(roomId);
    expect(lobby.snapshot()).toMatchObject({ bossMaxHp: 4500, bossHp: 4500, bossAttack: 14 });
  });
  it("retains saved tuning between rounds when no new participant has joined", () => {
    const { room } = team(10);
    const saved = room.save(); saved.balance!.maxHp = 2250; saved.balance!.attack = 25; saved.bossHp = 2250;
    const restored = LocalRaidRoom.restore(saved, () => 0);
    restored.start(saved.roomId);
    expect(restored.snapshot()).toMatchObject({ bossHp: 2250, bossMaxHp: 2250, bossAttack: 25 });
  });
});
