import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
const db = new PrismaClient();
const [action, eventId, argument] = process.argv.slice(2);
if (!eventId || !["end", "purge"].includes(action)) throw new Error("Usage: npm run event:end -- EVENT_ID RETENTION_HOURS | npm run event:purge -- EVENT_ID --confirm");
try {
  if (action === "end") {
    const hours = z.coerce.number().int().min(0).max(8760).parse(argument ?? 24);
    const now = new Date();
    const result = await db.event.updateMany({ where: { id: eventId, status: "ACTIVE" }, data: { status: "ENDED", endedAt: now, purgeAt: new Date(now.getTime() + hours * 3600_000) } });
    console.log(`Ended ${result.count} event(s). Already-ended retention dates are preserved.`);
  } else {
    if (argument !== "--confirm") throw new Error("Deletion requires --confirm and the explicit event ID.");
    await db.$transaction(async (tx) => {
      const events = await tx.$queryRaw<{ status: string; endedAt: Date | null; purgeAt: Date | null }[]>`SELECT "status", "endedAt", "purgeAt" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = events[0];
      if (!event || event.status !== "ENDED" || !event.endedAt || !event.purgeAt || event.purgeAt > new Date()) throw new Error("Only explicitly ended events past their retention date may be purged.");
      await tx.$executeRaw`DELETE FROM "RateLimitBucket" USING "Player" WHERE "RateLimitBucket"."key" IN ('nickname:' || "Player"."id", 'acquire:' || "Player"."id", 'raid-read:player:' || "Player"."id", 'raid-write:player:' || "Player"."id") AND "Player"."eventId" = ${eventId}`;
      await tx.raidRoom.deleteMany({ where: { eventId } });
      const deleted = await tx.player.deleteMany({ where: { eventId } });
      await tx.rateLimitBucket.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      console.log(`Deleted ${deleted.count} guest(s), their sessions and owned characters. Event/master data retained.`);
    });
  }
} finally { await db.$disconnect(); }
