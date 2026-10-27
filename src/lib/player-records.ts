import { db } from "./db";
import { characterImageUrl } from "./character-edit-input";
import type { AdventureRecords } from "./adventure-records";

export async function playerRecords(playerId: string): Promise<AdventureRecords> {
  const [owned, total, raidCount, victories, raids] = await db.$transaction([
    db.playerCharacter.findMany({ where: { playerId }, include: { character: true }, orderBy: { character: { sortOrder: "asc" } } }),
    db.character.count(),
    db.raidResult.count({ where: { playerId } }),
    db.raidResult.count({ where: { playerId, won: true } }),
    db.raidResult.findMany({ where: { playerId }, orderBy: [{ finishedAt: "desc" }, { id: "desc" }], take: 20 }),
  ], { isolationLevel: "RepeatableRead" });
  return {
    playerId, collected: owned.length, total, raidCount, victories,
    characters: owned.map(({ character, acquiredAt }) => ({ id: character.id, name: character.name, element: character.element, imageUrl: characterImageUrl(character.imageId), acquiredAt: acquiredAt.toISOString() })),
    raids: raids.map(({ id, roomId, characterId, characterName, bossName, won, turns, finishedAt }) => ({ id, roomId, characterId, characterName, bossName, won, turns, finishedAt: finishedAt.toISOString() })),
  };
}
