import { z } from "zod";
import { api, checkOrigin, HttpError, json, rateLimit, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/admin-session";
import { currentPlayer } from "@/lib/session";
import { withProductionRaid } from "@/lib/production-raid";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("join"), characterId: z.string().min(1).max(80), roomId: z.uuid().optional() }),
  z.strictObject({ type: z.literal("leave"), roomId: z.uuid() }),
  z.strictObject({ type: z.literal("remove"), roomId: z.uuid(), participantId: z.uuid() }),
  z.strictObject({ type: z.literal("command"), roomId: z.uuid(), round: z.number().int().positive(), requestId: z.uuid(), action: z.enum(["attack", "heal"]), hand: z.enum(["rock", "scissors", "paper"]) }),
  z.strictObject({ type: z.literal("start"), roomId: z.uuid() }),
  z.strictObject({ type: z.literal("reset"), roomId: z.uuid() }),
  z.strictObject({ type: z.literal("reveal"), roomId: z.uuid(), turn: z.number().int().positive() }),
  z.strictObject({ type: z.literal("impact"), roomId: z.uuid(), turn: z.number().int().positive(), kind: z.enum(["action", "counter"]) }),
  z.strictObject({ type: z.literal("finish"), roomId: z.uuid(), turn: z.number().int().positive() }),
]);

export async function GET(request: Request) {
  return api(async () => {
    const personal = new URL(request.url).searchParams.get("personal") === "1";
    if (personal) {
      const player = await currentPlayer();
      if (!player) throw new HttpError(401, "ゲストではじめてから参加してください。");
      await rateLimit(`raid-read:player:${player.id}`, 240);
      return json(await withProductionRaid((room) => ({ state: room.snapshot(player.id) })));
    }
    const admin = await requireAdmin();
    await rateLimit(`raid-read:admin:${admin.id}`, 240);
    return json(await withProductionRaid((room) => ({ state: room.snapshot() })));
  });
}

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const input = inputSchema.parse(await readJson(request));
    if (input.type !== "join" && input.type !== "command" && input.type !== "leave") {
      const admin = await requireAdmin();
      await rateLimit(`raid-write:admin:${admin.id}`, 120);
      return json(await withProductionRaid((room) => {
        if (input.type === "reset") {
          if (room.snapshot().roomId !== input.roomId) throw new HttpError(409, "最新のスクリーンで操作してください。");
          return { state: room.reset() };
        }
        if (input.type === "start") return { state: room.start(input.roomId) };
        if (input.type === "remove") return { state: room.remove(input.roomId, input.participantId) };
        if (input.type === "reveal") return { state: room.reveal(input.roomId, input.turn) };
        if (input.type === "impact") return { state: room.impact(input.roomId, input.turn, input.kind) };
        return { state: room.finish(input.roomId, input.turn) };
      }));
    }
    const player = await currentPlayer();
    if (!player) throw new HttpError(401, "ゲストではじめてから参加してください。");
    await rateLimit(`raid-write:player:${player.id}`, 60);
    return json(await withProductionRaid(async (room, tx) => {
      const current = await tx.player.findUnique({ where: { id: player.id }, include: { characters: true } });
      if (!current || current.eventId !== config().EVENT_ID) throw new HttpError(401, "ゲストではじめてから参加してください。");
      if (input.type === "command") return room.command(current.id, input);
      if (input.type === "leave") return { state: room.leave(input.roomId, current.id) };
      const admission = room.snapshot(current.id);
      if (input.roomId ? input.roomId !== admission.roomId : !admission.me) throw new HttpError(409, "会場の最新の受付QRを読み取ってください。");
      const character = await tx.character.findUnique({ where: { id: input.characterId } });
      const owned = current.characters.find((item) => item.characterId === input.characterId);
      if (!character || (current.characters.length ? !owned : character.isLegendary || character.isDraft)) throw new HttpError(403, "このキャラクターは参加に使用できません。");
      return { state: room.join(current.id, character.id, character.baseHp + (owned?.hpGrowth ?? 0), current.nickname || character.name, character.name) };
    }));
  });
}
