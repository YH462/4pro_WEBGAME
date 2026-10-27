import { Prisma } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { HttpError } from "./http-error";
import { LocalRaidError, LocalRaidRoom, type SavedRaidRoom } from "./local-raid-room";

/** Each request reconstructs the room from PostgreSQL, never a process-local cache. */
export async function withProductionRaid<T>(action: (room: LocalRaidRoom, tx: Prisma.TransactionClient) => Promise<T> | T) {
  const eventId = config().EVENT_ID;
  try {
    return await db.$transaction(async (tx) => {
      // Same lock order as guest entry/acquisition; event end/purge cannot race a battle write.
      const events = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
      if (events[0]?.status !== "ACTIVE") throw new HttpError(409, "現在はイベント受付期間外です。");
      const initial = JSON.stringify(new LocalRaidRoom().save());
      await tx.$executeRaw`INSERT INTO "RaidRoom" ("eventId", "state") VALUES (${eventId}, ${initial}::jsonb) ON CONFLICT ("eventId") DO NOTHING`;
      const rows = await tx.$queryRaw<{ state: SavedRaidRoom }[]>`SELECT "state" FROM "RaidRoom" WHERE "eventId" = ${eventId} FOR UPDATE`;
      const room = LocalRaidRoom.restore(rows[0].state);
      const result = await action(room, tx);
      const saved = room.save();
      if (saved.revision !== rows[0].state.revision) {
        await tx.raidRoom.update({ where: { eventId }, data: { state: saved as unknown as Prisma.InputJsonValue } });
      }
      return result;
    }, { maxWait: 10_000, timeout: 10_000 });
  } catch (error) {
    if (error instanceof LocalRaidError) throw new HttpError(error.status, error.message);
    throw error;
  }
}
