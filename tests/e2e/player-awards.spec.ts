import {test,expect} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {randomUUID} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {synchronizePlayerAwards} from "../../src/lib/player-awards";
import {playerRecords} from "../../src/lib/player-records";
import {db as recordsDb} from "../../src/lib/db";

test.skip(process.env.EVENT_ID!=="raid-production-test"||new URL(process.env.DATABASE_URL||"postgresql://localhost:5432/unused").port!=="55436","Use the isolated production environment.");
const db=new PrismaClient(),execute=promisify(execFile);
let eventId:string;
test.beforeEach(async()=>{eventId=`award-test-${randomUUID()}`;await db.event.create({data:{id:eventId,name:"報酬の専用検証"}});});
test.afterEach(async()=>{await db.event.delete({where:{id:eventId}});});
test.afterAll(async()=>{await Promise.all([db.$disconnect(),recordsDb.$disconnect()]);});
const savedResult=(playerId:string,won:boolean,at:number)=>({playerId,roomId:randomUUID(),characterId:"forest-golem",characterName:"記録キャラ",bossName:"デスドラグーン",won,turns:1,finishedAt:new Date(at)});

test("points and milestone grants survive concurrent retries and reach the 3/10 victory thresholds",async()=>{
  const player=await db.player.create({data:{eventId,characters:{create:["temp-06","temp-07","temp-08","temp-09"].map(characterId=>({characterId}))}}});
  await db.raidResult.createMany({data:[...Array.from({length:9},(_,i)=>savedResult(player.id,true,1000+i)),savedResult(player.id,false,2000)]});
  const first=await db.$transaction(tx=>synchronizePlayerAwards(tx,player.id));
  expect(first.pointsGranted).toBe(900);
  let records=await playerRecords(player.id);
  expect(records.awards).toMatchObject({points:900,activeTitle:"レイドの勇士"});
  expect(records.awards.achievements.find(item=>item.code==="department-complete")?.earnedAt).toBeNull();
  expect(records.awards.achievements.find(item=>item.code==="victory-10")).toMatchObject({progress:9,target:10,earnedAt:null});
  await db.raidResult.create({data:savedResult(player.id,true,3000)});
  const concurrent=await Promise.all([db.$transaction(tx=>synchronizePlayerAwards(tx,player.id)),db.$transaction(tx=>synchronizePlayerAwards(tx,player.id))]);
  expect(concurrent.reduce((sum,item)=>sum+item.pointsGranted,0)).toBe(100);
  records=await playerRecords(player.id);
  expect(records.awards).toMatchObject({points:1000,activeTitle:"レイドの英雄"});
  expect(records.awards.achievements.filter(item=>item.earnedAt)).toHaveLength(5);
  expect(await db.raidReward.count({where:{playerId:player.id}})).toBe(10);
  expect(await db.playerAchievement.count({where:{playerId:player.id}})).toBe(5);
  await db.player.delete({where:{id:player.id}});
  expect(await db.raidReward.count({where:{playerId:player.id}})).toBe(0);
  expect(await db.playerAchievement.count({where:{playerId:player.id}})).toBe(0);
});

test("a transaction failure cannot leave a reward or badge without its completed raid result",async()=>{
  const player=await db.player.create({data:{eventId}});
  await expect(db.$transaction(async tx=>{
    await tx.raidResult.create({data:savedResult(player.id,true,1000)});
    await synchronizePlayerAwards(tx,player.id);
    throw new Error("intentional rollback");
  })).rejects.toThrow("intentional rollback");
  expect(await db.raidResult.count({where:{playerId:player.id}})).toBe(0);
  expect(await db.raidReward.count({where:{playerId:player.id}})).toBe(0);
  expect(await db.playerAchievement.count({where:{playerId:player.id}})).toBe(0);
});

test("backfill dry-run is read-only and repeated application only grants from existing history once",async()=>{
  const winner=await db.player.create({data:{eventId}}),loser=await db.player.create({data:{eventId}});
  await db.raidResult.createMany({data:[savedResult(winner.id,true,1000),savedResult(loser.id,false,1000)]});
  const run=(apply=false)=>execute(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/backfill-player-awards.ts",`--event=${eventId}`,...(apply?["--apply"]:[])],{env:process.env});
  await run();expect(await db.raidReward.count({where:{player:{eventId}}})).toBe(0);
  expect(await db.playerAchievement.count({where:{player:{eventId}}})).toBe(0);
  expect(JSON.parse((await run(true)).stdout)).toMatchObject({pointsGranted:100,achievementsGranted:3});
  expect(JSON.parse((await run(true)).stdout)).toMatchObject({pointsGranted:0,achievementsGranted:0});
  expect((await playerRecords(winner.id)).awards.points).toBe(100);
  expect((await playerRecords(loser.id)).awards.points).toBe(0);
});
