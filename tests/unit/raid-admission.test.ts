import { describe, expect, it } from "vitest";
import { LocalRaidRoom, raidTutorialMs, raidLateJoinMs } from "../../src/lib/local-raid-room";
import { raidAdmissionUrl } from "../../src/lib/raid-admission";
import { startDestination } from "../../src/lib/acquisition-links";
import { raidQrDestination } from "../../src/lib/raid-qr";

describe("reception membership", () => {
  it("frees a waiting slot and recalculates boss capacity without touching other members", () => {
    const room = new LocalRaidRoom();
    for (let i = 0; i < 20; i++) room.join(`p${i}`, "forest-golem", 170, `P${i}`);
    const before = room.snapshot(); const id = before.members[0].id;
    room.remove(before.roomId, id);
    expect(room.snapshot()).toMatchObject({ participants: 19, bossHp: 8550, bossMaxHp: 8550 });
    expect(room.snapshot("p0")).toMatchObject({ me: null, removedFromLobby: true });
    expect(() => room.join("p0", "forest-golem", 170, "P0")).toThrow("解除");
    const restored = LocalRaidRoom.restore(room.save());
    expect(() => restored.join("p0", "forest-golem", 170, "P0")).toThrow("解除");
    restored.join("new", "forest-golem", 170, "NEW");
    expect(restored.snapshot().participants).toBe(20);
    restored.remove(before.roomId, id); expect(restored.snapshot().participants).toBe(20);
  });
  it("lets a participant cancel waiting admission and explicitly enter again", () => {
    const room = new LocalRaidRoom(); room.join("p", "forest-golem", 170, "P");
    const id = room.snapshot().roomId; room.leave(id, "p");
    expect(room.snapshot("p")).toMatchObject({ participants: 0, me: null, removedFromLobby: false });
    room.join("p", "forest-golem", 170, "P"); expect(room.snapshot().participants).toBe(1);
  });
  it("accepts arrivals during explanation, keeps staff removal locked and accepts reconnects after the deadline", () => {
    let now = 0;
    const room = new LocalRaidRoom(undefined, () => now); room.join("p", "forest-golem", 170, "P");
    const state = room.snapshot(); room.start(state.roomId);
    expect(room.join("late", "forest-golem", 170, "LATE").participants).toBe(2);
    expect(() => room.remove(state.roomId, state.members[0].id)).toThrow("開始前");
    expect(() => room.leave(state.roomId, "p")).toThrow("開始前");
    now = raidTutorialMs + raidLateJoinMs;
    expect(() => room.join("too-late", "forest-golem", 170, "LATE")).toThrow("受付は終了");
    expect(room.join("p", "forest-golem", 170, "P").participants).toBe(2);
  });
  it("rotates reception URLs on reset, preserves room-scoped return paths and leaves character QR helpers separate", () => {
    const room = new LocalRaidRoom(); const before = room.snapshot().roomId;
    const oldUrl = raidAdmissionUrl("https://venue.example", before);
    expect(raidQrDestination(oldUrl, "https://venue.example")).toBe(`/battle/raid?room=${before}`);
    expect(startDestination({ next: "raid", room: before })).toBe(`/battle/raid?room=${before}`);
    room.reset(); const after = room.snapshot().roomId;
    expect(raidAdmissionUrl("https://venue.example", after)).not.toBe(oldUrl);
    expect(() => room.leave(before, "p")).toThrow("リセット");
    expect(startDestination({ next: "raid", room: "https://evil.example" })).toBe("/battle/raid");
  });
});
