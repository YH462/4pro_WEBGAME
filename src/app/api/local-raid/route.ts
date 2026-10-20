import { z } from "zod";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { api, checkOrigin, HttpError, json, readJson } from "@/lib/http";
import { currentPlayer } from "@/lib/session";
import { isTemporaryCharacter } from "@/lib/master-data";
import { localRaidRoom, LocalRaidError } from "@/lib/local-raid-room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), characterId: z.string().min(1).max(80) }).strict(),
  z.object({ type: z.literal("command"), roomId: z.uuid(), requestId: z.uuid(), action: z.enum(["attack", "heal"]), hand: z.enum(["rock", "scissors", "paper"]) }).strict(),
  z.object({ type: z.literal("reset") }).strict(),
]);
function enabled() { if (!config().simulator) throw new HttpError(404, "ローカル同期は開発モード専用です。"); }

export async function GET(request: Request) {
  return api(async () => {
    enabled();
    const personal = new URL(request.url).searchParams.get("personal") === "1";
    const player = personal ? await currentPlayer() : null;
    if (personal && !player) throw new HttpError(401, "ゲストではじめてから参加してください。");
    return json({ state: localRaidRoom().snapshot(player?.id) });
  });
}

export async function POST(request: Request) {
  return api(async () => {
    enabled();
    checkOrigin(request);
    const input = inputSchema.parse(await readJson(request));
    const room = localRaidRoom();
    try {
      // Local development operator control; this is not the production staff interface.
      if (input.type === "reset") return json({ state: room.reset() });
      const player = await currentPlayer();
      if (!player) throw new HttpError(401, "ゲストではじめてから参加してください。");
      if (player.event.status !== "ACTIVE") throw new HttpError(409, "イベントは終了しています。");
      if (input.type === "command") return json(room.command(player.id, input));
      const character = await db.character.findUnique({ where: { id: input.characterId } });
      const owned = player.characters.find((item) => item.characterId === input.characterId);
      if (!character || (player.characters.length ? !owned : character.isLegendary || isTemporaryCharacter(character.id))) throw new HttpError(403, "このキャラクターは参加に使用できません。");
      return json({ state: room.join(player.id, character.id, character.baseHp + (owned?.hpGrowth ?? 0), player.nickname || character.name) });
    } catch (error) {
      if (error instanceof LocalRaidError) throw new HttpError(error.status, error.message);
      throw error;
    }
  });
}
