import { Prisma } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { HttpError } from "./http-error";
import { LocalRaidError, LocalRaidRoom, type SavedRaidRoom } from "./local-raid-room";
import { battlePreview } from "./battle-preview";

type PersistedRaidRoom = SavedRaidRoom & { resultRecorded?: boolean };

async function recordFinishedRaid(tx: Prisma.TransactionClient, state: SavedRaidRoom, eventId: string) {
  const participants = state.members.filter(([, member]) => member.lastResult !== null);
  if (!participants.length) return;
  const players = await tx.player.findMany({ where: { id: { in: participants.map(([id]) => id) }, eventId }, select: { id: true } });
  const existing = new Set(players.map(player => player.id));
  const finishedAt = new Date();
  const data = participants.filter(([id]) => existing.has(id)).map(([playerId, member]) => ({
    roomId: state.roomId, playerId, characterId: member.lastResult!.characterId,
    characterName: member.lastResult!.characterName, bossName: battlePreview.bossName,
    won: state.bossHp <= 0, turns: state.turn, finishedAt,
  }));
  if (data.length) await tx.raidResult.createMany({ data, skipDuplicates: true });
}

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
      const rows = await tx.$queryRaw<{ state: PersistedRaidRoom }[]>`SELECT "state" FROM "RaidRoom" WHERE "eventId" = ${eventId} FOR UPDATE`;
      const { resultRecorded: recordedBefore = false, ...previous } = rows[0].state;
      let previousRecorded = recordedBefore;
      // Preserve a finished legacy room even if this request immediately resets it.
      if (previous.phase === "finished" && !previousRecorded) {
        await recordFinishedRaid(tx, previous, eventId); previousRecorded = true;
      }
      const room = LocalRaidRoom.restore(previous);
      const result = await action(room, tx);
      const saved = room.save();
      let resultRecorded = saved.roomId === previous.roomId && previousRecorded;
      if (saved.phase === "finished" && !resultRecorded) {
        await recordFinishedRaid(tx, saved, eventId); resultRecorded = true;
      }
      if (saved.revision !== previous.revision || resultRecorded !== recordedBefore) {
        await tx.raidRoom.update({ where: { eventId }, data: { state: { ...saved, resultRecorded } as unknown as Prisma.InputJsonValue } });
      }
      return result;
    }, { maxWait: 10_000, timeout: 10_000 });
  } catch (error) {
    if (error instanceof LocalRaidError) throw new HttpError(error.status, error.message);
    throw error;
  }
}
