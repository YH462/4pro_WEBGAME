import "dotenv/config";
import { db } from "../src/lib/db";
import { synchronizePlayerAwards } from "../src/lib/player-awards";

// Explicit backfill from recorded ownership and completed battles. GETs remain
// read-only; unknown/previously discarded battles are never invented.
const apply=process.argv.includes("--apply");
const eventId=process.argv.find(arg=>arg.startsWith("--event="))?.slice(8);
let cursor:string|undefined,processed=0,points=0,achievements=0;
try{
  do{
    const players=await db.player.findMany({where:eventId?{eventId}:{},orderBy:{id:"asc"},take:100,...(cursor?{cursor:{id:cursor},skip:1}:{}),select:{id:true}});
    if(!players.length)break;
    for(const player of players){
      if(apply){
        const result=await db.$transaction(tx=>synchronizePlayerAwards(tx,player.id),{maxWait:10000,timeout:10000});
        points+=result.pointsGranted;achievements+=result.achievementsGranted;
      }
      processed++;
    }
    cursor=players.at(-1)!.id;
  }while(true);
  console.log(JSON.stringify({mode:apply?"applied":"dry-run",players:processed,pointsGranted:points,achievementsGranted:achievements}));
  if(!apply)console.log("No DB writes. Add --apply after confirming DATABASE_URL and taking a backup.");
}finally{await db.$disconnect();}
