import type { Prisma } from "@prisma/client";
import { collectionDepartmentIds, eligibleAchievements, raidVictoryPoints } from "./achievement-rules";

/** Run inside the acquisition/finished-raid transaction. The Player lock
 * serializes different award sources; unique constraints also protect retries. */
export async function synchronizePlayerAwards(tx:Prisma.TransactionClient,playerId:string) {
  const players=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Player" WHERE "id"=${playerId} FOR UPDATE`;
  if(!players.length)return {pointsGranted:0,achievementsGranted:0};
  const [owned,raids,victories,missingRewards]=await Promise.all([
    tx.playerCharacter.findMany({where:{playerId},select:{acquiredAt:true,character:{select:{departmentId:true}}}}),
    tx.raidResult.findMany({where:{playerId},orderBy:[{finishedAt:"asc"},{id:"asc"}],take:1,select:{finishedAt:true}}),
    tx.raidResult.findMany({where:{playerId,won:true},orderBy:[{finishedAt:"asc"},{id:"asc"}],take:10,select:{finishedAt:true}}),
    tx.raidResult.findMany({where:{playerId,won:true,reward:{is:null}},select:{id:true,finishedAt:true}}),
  ]);
  const departmentTimes=collectionDepartmentIds.map(id=>owned.filter(item=>item.character.departmentId===id).map(item=>item.acquiredAt).sort((a,b)=>a.getTime()-b.getTime())[0]);
  const facts={collected:owned.length,departments:departmentTimes.filter(Boolean).length,raids:raids.length,victories:victories.length};
  const firstCollection=owned.map(item=>item.acquiredAt).sort((a,b)=>a.getTime()-b.getTime())[0];
  const badges=eligibleAchievements(facts).map(rule=>({playerId,code:rule.code,earnedAt:
    rule.metric==="collected"?firstCollection:rule.metric==="departments"?new Date(Math.max(...departmentTimes.map(time=>time!.getTime()))):rule.metric==="raids"?raids[0].finishedAt:victories[rule.target-1].finishedAt,
  }));
  const rewards=await tx.raidReward.createMany({data:missingRewards.map(result=>({playerId,raidResultId:result.id,points:raidVictoryPoints,awardedAt:result.finishedAt})),skipDuplicates:true});
  const achievements=await tx.playerAchievement.createMany({data:badges,skipDuplicates:true});
  return {pointsGranted:rewards.count*raidVictoryPoints,achievementsGranted:achievements.count};
}
