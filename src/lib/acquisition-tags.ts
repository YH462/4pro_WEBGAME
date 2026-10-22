import { db } from "./db";
import { config } from "./config";
import { localNetworkHosts } from "./local-network";
import { acquisitionUrl } from "./acquisition-links";
import { newToken, tokenHash } from "./tokens";
import { HttpError } from "./http-error";

export function acquisitionOrigins() {
  const cfg=config(), canonical=new URL(cfg.APP_URL);
  const lan=cfg.simulator && cfg.ALLOW_INSECURE_LOCAL_HTTP==="true" && canonical.protocol==="http:" ? localNetworkHosts().filter((host)=>!['localhost','127.0.0.1'].includes(host)).map((host)=>`http://${host}:${canonical.port||"80"}`) : [];
  return [...new Set([...lan,cfg.origin])];
}
export async function issueAcquisitionTag(characterId:string,origin:string) {
  if(!acquisitionOrigins().includes(origin)) throw new HttpError(400,"発行先は会場URLまたは現在のPCの開発用URLを選んでください。");
  const token=newToken(),url=acquisitionUrl(token,origin),eventId=config().EVENT_ID;
  const tag=await db.$transaction(async(tx)=>{
    const events=await tx.$queryRaw<{status:string}[]>`SELECT "status" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
    if(events[0]?.status!=="ACTIVE") throw new HttpError(409,"終了したイベントではタグを発行できません。");
    const character=await tx.character.findUnique({where:{id:characterId}});
    if(!character) throw new HttpError(404,"キャラクターが見つかりません。");
    if(character.isLegendary) throw new HttpError(409,"4プロは学科キャラ4体の獲得で解放します。タグは発行できません。");
    return tx.acquisitionTag.create({data:{eventId,characterId,tokenHash:tokenHash(token)},select:{id:true,characterId:true,createdAt:true,enabled:true}});
  });
  return {...tag,url};
}
export async function tagsForCharacter(characterId:string) {
  const character=await db.character.findUnique({where:{id:characterId},include:{department:true}});
  if(!character) throw new HttpError(404,"キャラクターが見つかりません。");
  const tags=await db.acquisitionTag.findMany({where:{eventId:config().EVENT_ID,OR:[{characterId},...(character.departmentId?[{characterId:null,departmentId:character.departmentId}]:[])]},orderBy:{createdAt:"desc"},select:{id:true,enabled:true,createdAt:true,characterId:true,_count:{select:{acquisitions:true}}}});
  return {character,tags};
}
