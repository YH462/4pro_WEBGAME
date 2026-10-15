import { db } from "@/lib/db";
import { api, HttpError, json } from "@/lib/http";
import { currentPlayer } from "@/lib/session";
export async function GET() {
  return api(async () => {
    const player = await currentPlayer();
    if (!player) throw new HttpError(401, "ゲストとしてはじめてください。");
    const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true, skills: { orderBy: { slot: "asc" } } } });
    return json({ characters: characters.map((character) => ({ ...character, owned: player.characters.find((owned) => owned.characterId === character.id) ?? null })) });
  });
}
