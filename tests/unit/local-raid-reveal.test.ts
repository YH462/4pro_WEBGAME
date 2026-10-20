import { describe, expect, it, vi } from "vitest";
import { LocalRaidRoom } from "../../src/lib/local-raid-room";
import { visibleLocalRaid } from "../../src/lib/local-raid-presentation";

function setup() {
  const room = new LocalRaidRoom(() => "paper");
  room.join("a", "forest-golem", 170, "A");
  room.join("b", "forest-golem", 170, "B");
  const command = (player: string) => room.command(player, { roomId: room.snapshot().roomId, requestId: player, action: "attack", hand: "scissors" });
  return { room, command };
}

describe("screen-controlled RPS result release", () => {
  it("keeps each queued player's result and HP hidden until their own reveal", () => {
    const { room, command } = setup();
    const a = command("a"), b = command("b");
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 450, me: { hp: 170, lastResult: null }, lastResult: null });
    expect(visibleLocalRaid(room.snapshot("b"))).toMatchObject({ bossHp: 450, me: { hp: 170, lastResult: null } });
    room.reveal(a.state.roomId, a.result.turn);
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 450, me: { hp: 170, lastResult: a.result }, lastResult: a.result });
    room.impact(a.state.roomId, a.result.turn, "action");
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 350, me: { hp: 170 } });
    room.impact(a.state.roomId, a.result.turn, "counter");
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 350, me: { hp: 150 } });
    expect(visibleLocalRaid(room.snapshot("b"))).toMatchObject({ bossHp: 350, me: { hp: 170, lastResult: null }, lastResult: a.result });
    room.reveal(b.state.roomId, b.result.turn);
    expect(visibleLocalRaid(room.snapshot("b"))).toMatchObject({ bossHp: 350, me: { hp: 170, lastResult: b.result } });
    room.impact(b.state.roomId, b.result.turn, "counter");
    expect(visibleLocalRaid(room.snapshot("b"))).toMatchObject({ bossHp: 250, me: { hp: 150, lastResult: b.result } });
    expect(room.snapshot("a").me?.hp).toBe(150);
  });

  it("shows healing before the boss counter instead of collapsing both into a single HP change", () => {
    let now = 0;
    const room = new LocalRaidRoom(() => "paper", () => now += 1500);
    room.join("a", "forest-golem", 170, "A");
    const roomId = room.snapshot().roomId;
    room.command("a", { roomId, requestId: "attack", action: "attack", hand: "scissors" });
    room.impact(roomId, 1, "counter");
    const heal = room.command("a", { roomId, requestId: "heal", action: "heal", hand: "scissors" });
    room.reveal(roomId, 2);
    expect(heal.result.amount).toBe(20);
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(150);
    room.impact(roomId, 2, "action");
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(170);
    const revision = room.snapshot().revision;
    room.impact(roomId, 2, "action");
    expect(room.snapshot().revision).toBe(revision);
    room.impact(roomId, 2, "counter");
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(150);
  });

  it("keeps later queued actions hidden and settles a lethal strike without waiting for a counter", () => {
    const room = new LocalRaidRoom(() => "paper", (() => { let now = 0; return () => now += 1500; })());
    room.join("a", "forest-golem", 170, "A");
    const roomId = room.snapshot().roomId;
    for (let i = 1; i <= 5; i++) room.command("a", { roomId, requestId: `attack-${i}`, action: "attack", hand: "scissors" });
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(170);
    room.impact(roomId, 1, "counter");
    expect(visibleLocalRaid(room.snapshot("a")).me?.hp).toBe(150);
    room.reveal(roomId, 5);
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 50, me: { hp: 90 } });
    room.impact(roomId, 5, "action");
    expect(room.snapshot().counterTurn).toBe(5);
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 0, me: { hp: 90 } });
  });

  it("wakes HP watchers at impacts, ignores stale acknowledgements and clears progress on reset", async () => {
    const { room, command } = setup();
    const { state } = command("a");
    room.reveal(state.roomId, 1);
    const changed = vi.fn();
    const waiting = room.waitForRevision(state.roomId, room.snapshot().revision).then(changed);
    await Promise.resolve(); expect(changed).not.toHaveBeenCalled();
    const hit = room.impact(state.roomId, 1, "counter");
    await waiting; expect(changed).toHaveBeenCalledOnce();
    expect(room.impact(state.roomId, 1, "action").revision).toBe(hit.revision);
    expect(room.reveal(state.roomId, 1).revision).toBe(hit.revision);
    const reset = room.waitForRevision(state.roomId, hit.revision);
    room.reset(); await reset;
    expect(room.snapshot()).toMatchObject({ revealedTurn: 0, actionTurn: 0, counterTurn: 0 });
    expect(() => room.impact(state.roomId, 1, "counter")).toThrow("リセット");
  });

  it("wakes a waiting phone when the screen reveals and deduplicates acknowledgements", async () => {
    const { room, command } = setup();
    const { state, result } = command("a");
    const notified = vi.fn();
    const waiting = room.waitForReveal(state.roomId, result.turn).then(notified);
    await Promise.resolve(); expect(notified).not.toHaveBeenCalled();
    const revealed = room.reveal(state.roomId, result.turn);
    await waiting; expect(notified).toHaveBeenCalledOnce();
    expect(room.reveal(state.roomId, result.turn).revision).toBe(revealed.revision);
    expect(() => room.reveal(state.roomId, result.turn + 1)).toThrow("行動");
  });

  it("unblocks polls on reset or disconnect and rejects stale-room acknowledgements", async () => {
    const { room, command } = setup();
    const { state, result } = command("a");
    const controller = new AbortController();
    const aborted = room.waitForReveal(state.roomId, result.turn, controller.signal);
    controller.abort(); await aborted;
    expect(room.snapshot().revealedTurn).toBe(0);
    const waiting = room.waitForReveal(state.roomId, result.turn);
    room.reset(); await waiting;
    expect(room.snapshot().revealedTurn).toBe(0);
    expect(() => room.reveal(state.roomId, result.turn)).toThrow("リセット");
  });
});
