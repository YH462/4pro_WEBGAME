import { db } from "@/lib/db";
import { api, checkOrigin, HttpError, json, rateLimit, readJson } from "@/lib/http";
import { currentPlayer } from "@/lib/session";
import { nicknameSchema } from "@/lib/validation";
export async function GET() {
  return api(async () => {
    const player = await currentPlayer();
    if (!player) throw new HttpError(401, "ゲストとしてはじめてください。");
    return json({ player: { id: player.id, nickname: player.nickname, createdAt: player.createdAt, event: { name: player.event.name, status: player.event.status }, characters: player.characters } });
  });
}
export async function PATCH(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const player = await currentPlayer();
    if (!player) throw new HttpError(401, "ゲストとしてはじめてください。");
    await rateLimit(`nickname:${player.id}`, 20);
    const input = nicknameSchema.parse(await readJson(request));
    const updated = await db.player.update({ where: { id: player.id }, data: { nickname: input.nickname || null }, select: { id: true, nickname: true } });
    return json({ player: updated });
  });
}
