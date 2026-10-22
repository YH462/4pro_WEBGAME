import { z } from "zod";
import { api, checkOrigin, HttpError, json, rateLimit, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/admin-session";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
const schema=z.strictObject({enabled:z.boolean()});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  return api(async()=>{
    checkOrigin(request);
    const admin=await requireAdmin();
    await rateLimit(`admin-tags:${admin.id}`,30);
    const {enabled}=schema.parse(await readJson(request));
    const {id}=await params;
    await db.$transaction(async(tx)=>{
      const eventId=config().EVENT_ID;
      const events=await tx.$queryRaw<{status:string}[]>`SELECT "status" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
      if(enabled && events[0]?.status!=="ACTIVE") throw new HttpError(409,"終了したイベントのタグは有効にできません。");
      const updated=await tx.acquisitionTag.updateMany({where:{id,eventId},data:{enabled}});
      if(!updated.count) throw new HttpError(404,"タグが見つかりません。");
    });
    return json({id,enabled});
  });
}
