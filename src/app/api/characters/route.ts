import { db } from "@/lib/db";
import { api, HttpError, json } from "@/lib/http";
import { currentPlayer } from "@/lib/session";
export async function GET() {
  return api(async () => {
    const player = await currentPlayer();
    if (!player) throw new HttpError(401, "ゲストとしてはじめてください。");
    const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true, skills: { where: { slot: 1 } } } });
    return json({ characters: characters.map(({ skills, ...character }) => ({
      ...character,
      specialMove: skills[0] ? { ...skills[0], name: skills[0].confirmed ? skills[0].name : "必殺技" } : null,
      owned: player.characters.find((owned) => owned.characterId === character.id) ?? null,
    })) });
  });
}
