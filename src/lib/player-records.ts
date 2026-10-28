import { db } from "./db";
import { characterImageUrl } from "./character-edit-input";
import type { AdventureRecords } from "./adventure-records";
import { achievementViews, collectionDepartmentIds } from "./achievement-rules";

export async function playerRecords(playerId: string): Promise<AdventureRecords> {
  const [owned, total, raidCount, victories, raids, points, achievements, rewards] = await db.$transaction([
    db.playerCharacter.findMany({ where: { playerId }, include: { character: true }, orderBy: { character: { sortOrder: "asc" } } }),
    db.character.count(),
    db.raidResult.count({ where: { playerId } }),
    db.raidResult.count({ where: { playerId, won: true } }),
    db.raidResult.findMany({ where: { playerId }, orderBy: [{ finishedAt: "desc" }, { id: "desc" }], take: 20 }),
    db.raidReward.aggregate({where:{playerId},_sum:{points:true}}),
    db.playerAchievement.findMany({where:{playerId},select:{code:true,earnedAt:true}}),
    db.raidReward.findMany({where:{playerId},orderBy:[{awardedAt:"desc"},{id:"desc"}],take:10,include:{raidResult:{select:{bossName:true}}}}),
  ], { isolationLevel: "RepeatableRead" });
  return {
    playerId, collected: owned.length, total, raidCount, victories,
    characters: owned.map(({ character, acquiredAt }) => ({ id: character.id, name: character.name, element: character.element, imageUrl: characterImageUrl(character.imageId), acquiredAt: acquiredAt.toISOString() })),
    raids: raids.map(({ id, roomId, characterId, characterName, bossName, won, turns, finishedAt }) => ({ id, roomId, characterId, characterName, bossName, won, turns, finishedAt: finishedAt.toISOString() })),
    awards:{
      points:points._sum.points??0,
      ...achievementViews({collected:owned.length,departments:new Set(owned.flatMap(item=>item.character.departmentId&&collectionDepartmentIds.includes(item.character.departmentId as typeof collectionDepartmentIds[number])?[item.character.departmentId]:[])).size,raids:raidCount,victories},achievements),
      rewards:rewards.map(item=>({id:item.id,points:item.points,bossName:item.raidResult.bossName,awardedAt:item.awardedAt.toISOString()})),
    },
  };
}
