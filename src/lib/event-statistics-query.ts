import { Prisma } from "@prisma/client";
import { db } from "./db";
import { config } from "./config";
import { HttpError } from "./http-error";
import { buildEventStatistics } from "./event-statistics";

/** Read one event consistently; never advances the raid or synchronizes awards. */
export async function readEventStatistics(){
  const eventId=config().EVENT_ID;
  return db.$transaction(async tx=>{
    const [event,players,characters,collections,results,rewards]=await Promise.all([
      tx.event.findUnique({where:{id:eventId},select:{id:true,name:true,status:true}}),
      tx.player.findMany({where:{eventId},select:{id:true,nickname:true,createdAt:true}}),
      tx.character.findMany({select:{id:true,name:true,departmentId:true,isLegendary:true,sortOrder:true}}),
      tx.playerCharacter.findMany({where:{player:{eventId}},select:{playerId:true,characterId:true,acquiredAt:true},orderBy:[{acquiredAt:"asc"},{id:"asc"}]}),
      tx.raidResult.findMany({where:{player:{eventId}},select:{id:true,roomId:true,playerId:true,characterId:true,characterName:true,bossName:true,won:true,turns:true,finishedAt:true},orderBy:[{finishedAt:"asc"},{id:"asc"}]}),
      tx.raidReward.findMany({where:{player:{eventId}},select:{playerId:true,raidResultId:true,points:true}}),
    ]);
    if(!event)throw new HttpError(404,"イベントが設定されていません。");
    return buildEventStatistics({event,players,characters,collections,results,rewards});
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,maxWait:5000,timeout:15000});
}
