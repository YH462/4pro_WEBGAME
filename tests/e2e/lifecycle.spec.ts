import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
const execute = promisify(execFile);
test("active events cannot be purged; explicit end, retention and confirmation are required", async () => {
  const db = new PrismaClient();
  const id = `e2e-lifecycle-${randomUUID()}`;
  const cli = (action: string, argument: string) => execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/event-lifecycle.ts", action, id, argument], { env: process.env });
  try {
    await db.event.create({ data: { id, name: "E2E lifecycle", players: { create: { nickname: "削除テスト", sessions: { create: { tokenHash: randomUUID().replaceAll("-", "").padEnd(64, "0"), expiresAt: new Date(Date.now() + 60000) } }, characters: { create: { characterId: "forest-golem" } } } } } });
    const player = await db.player.findFirstOrThrow({ where: { eventId: id } });
    await db.rateLimitBucket.create({ data: { key: `nickname:${player.id}`, hits: 1, expiresAt: new Date(Date.now() + 60_000) } });
    await expect(cli("purge", "--confirm")).rejects.toThrow();
    expect(await db.player.count({ where: { eventId: id } })).toBe(1);
    await cli("end", "24");
    await expect(cli("purge", "--confirm")).rejects.toThrow();
    const ended = await db.event.findUniqueOrThrow({ where: { id } });
    await cli("end", "0");
    expect((await db.event.findUniqueOrThrow({ where: { id } })).purgeAt).toEqual(ended.purgeAt);
    const past = new Date(Date.now() - 1000);
    await db.event.update({ where: { id }, data: { endedAt: past, purgeAt: past } });
    await expect(cli("purge", "")).rejects.toThrow();
    await cli("purge", "--confirm");
    expect(await db.player.count({ where: { eventId: id } })).toBe(0);
    expect(await db.guestSession.count({ where: { playerId: player.id } })).toBe(0);
    expect(await db.playerCharacter.count({ where: { playerId: player.id } })).toBe(0);
    expect(await db.rateLimitBucket.count({ where: { key: `nickname:${player.id}` } })).toBe(0);
    expect(await db.event.count({ where: { id } })).toBe(1);
    expect(await db.character.count()).toBe(5);
  } finally { await db.event.deleteMany({ where: { id } }); await db.$disconnect(); }
});
