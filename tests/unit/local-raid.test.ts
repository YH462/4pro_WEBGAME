import { describe, expect, it } from "vitest";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";
import { privateIpv4 } from "../../src/lib/local-network";

describe("local raid room", () => {
  function setup() {
    let now = 10000;
    const room = new LocalRaidRoom(() => "paper", () => now);
    room.join("one", "forest-golem", 170, "ひとりめ");
    room.join("two", "aqua-spirit", 135, "ふたりめ");
    return { room, tick: () => { now += 1500; }, command: (player: string, id: string, action: "attack" | "heal" = "attack", hand: "rock" | "scissors" | "paper" = "scissors") => room.command(player, { roomId: room.snapshot().roomId, requestId: id, action, hand }) };
  }

  it("shares boss damage, applies the 2x multiplier on the server, and counters only the actor", () => {
    const { room, command } = setup();
    const response = command("one", "first");
    expect(response.result).toMatchObject({ label: "勝ち", multiplier: 2, amount: 100, counterDamage: 20 });
    expect(room.snapshot()).toMatchObject({ bossHp: 350, participants: 2, totalDamage: 100, attackCount: 1 });
    expect(room.snapshot("one").me?.hp).toBe(150);
    expect(room.snapshot("two").me?.hp).toBe(135);
    expect(room.snapshot().me).toBeNull();
  });

  it("limits healing to the actor's missing HP and preserves the other player's HP", () => {
    const { room, command, tick } = setup();
    command("one", "attack"); tick();
    const heal = command("one", "heal", "heal");
    expect(heal.result.amount).toBe(20); // 30 * 2, capped at 20 missing HP.
    expect(room.snapshot("one").me?.hp).toBe(150); // Healed to 170, then countered for 20.
    expect(room.snapshot("two").me?.hp).toBe(135);
    expect(room.snapshot()).toMatchObject({ bossHp: 350, totalHealing: 20, healCount: 1, attackCount: 0 });
  });

  it("replays a request without applying damage twice and refuses a changed payload", () => {
    const { room, command } = setup();
    const first = command("one", "same");
    const replay = command("one", "same");
    expect(replay.result).toEqual(first.result);
    expect(room.snapshot()).toMatchObject({ bossHp: 350, turn: 1 });
    expect(() => command("one", "same", "heal")).toThrow("同じ送信ID");
  });

  it("serializes actions from two players and clamps damage at zero HP", () => {
    const { room, command, tick } = setup();
    command("one", "a"); command("two", "b"); tick();
    command("one", "c"); command("two", "d"); tick();
    const last = command("one", "e");
    expect(last.result).toMatchObject({ amount: 50, counterDamage: 0 });
    expect(room.snapshot()).toMatchObject({ bossHp: 0, totalDamage: 450, turn: 5 });
    expect(() => command("two", "f")).toThrow("討伐成功");
  });

  it("rejects stale rooms, repeated rapid actions, unregistered players, and invalid HP", () => {
    const { room, command } = setup();
    const oldRoom = room.snapshot().roomId;
    expect(() => command("unknown", "x")).toThrow("先に");
    command("one", "first");
    expect(() => command("one", "rapid")).toThrow("少しお待ちください");
    room.reset();
    expect(room.snapshot()).toMatchObject({ bossHp: 450, participants: 0, totalDamage: 0 });
    expect(() => room.command("one", { roomId: oldRoom, requestId: "stale", action: "attack", hand: "rock" })).toThrow("リセット");
    expect(() => room.join("x", "character", NaN, "bad")).toThrow("HP");
  });

  it("rejoining does not restore HP and character changes preserve the HP ratio", () => {
    const { room, command } = setup();
    command("one", "a");
    room.join("one", "forest-golem", 170, "ひとりめ");
    expect(room.snapshot("one").me?.hp).toBe(150);
    room.join("one", "aqua-spirit", 135, "ひとりめ");
    expect(room.snapshot("one").me?.hp).toBe(Math.floor(150 / 170 * 135));
  });

  it("does not expose mutable internal member or result objects", () => {
    const { room, command } = setup();
    command("one", "a");
    const snapshot = room.snapshot("one");
    snapshot.me!.hp = 999;
    snapshot.lastResult!.amount = 999;
    expect(room.snapshot("one").me?.hp).toBe(150);
    expect(room.snapshot().lastResult?.amount).toBe(100);
  });
});

describe("LAN addresses", () => {
  it.each(["10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.1.2"])("recognizes %s as a private LAN address", (host) => expect(privateIpv4(host)).toBe(true));
  it.each(["8.8.8.8", "172.15.1.1", "172.32.1.1", "127.0.0.1", "192.168.1.999", "evil.example"])("excludes %s from the LAN allowlist", (host) => expect(privateIpv4(host)).toBe(false));
});
