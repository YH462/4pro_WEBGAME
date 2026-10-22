import { z } from "zod";
import QRCode from "qrcode";
import { api, checkOrigin, json, rateLimit, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/admin-session";
import { issueAcquisitionTag, tagsForCharacter } from "@/lib/acquisition-tags";
const id=z.string().min(1).max(80);
const issueSchema=z.strictObject({characterId:id,origin:z.string().max(300)});
export const runtime="nodejs";
export async function GET(request:Request) {
  return api(async()=>{
    await requireAdmin();
    const characterId=id.parse(new URL(request.url).searchParams.get("characterId"));
    const {tags}=await tagsForCharacter(characterId);
    return json({tags});
  });
}
export async function POST(request:Request) {
  return api(async()=>{
    checkOrigin(request);
    const admin=await requireAdmin();
    await rateLimit(`admin-tags:${admin.id}`,30);
    const input=issueSchema.parse(await readJson(request));
    const tag=await issueAcquisitionTag(input.characterId,input.origin);
    const qrImage=await QRCode.toDataURL(tag.url,{width:360,margin:4,errorCorrectionLevel:"M"});
    return json({tag,qrImage},201);
  });
}
