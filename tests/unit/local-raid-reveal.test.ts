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
    expect(visibleLocalRaid(room.snapshot("a"))).toMatchObject({ bossHp: 350, me: { hp: 150, lastResult: a.result }, lastResult: a.result });
    expect(visibleLocalRaid(room.snapshot("b"))).toMatchObject({ bossHp: 350, me: { hp: 170, lastResult: null }, lastResult: a.result });
    room.reveal(b.state.roomId, b.result.turn);
    expect(visibleLocalRaid(room.snapshot("b"))).toMatchObject({ bossHp: 250, me: { hp: 150, lastResult: b.result } });
    expect(room.snapshot("a").me?.hp).toBe(150);
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
