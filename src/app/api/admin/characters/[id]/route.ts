import { api,checkOrigin,json,rateLimit } from "@/lib/http";
import { requireAdmin } from "@/lib/admin-session";
import { readCharacterEdit,updateCharacter } from "@/lib/character-edit";
export const runtime="nodejs";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  return api(async()=>{
    checkOrigin(request,"multipart/form-data");
    const admin=await requireAdmin();
    await rateLimit(`admin-edit:${admin.id}`,20);
    const edit=await readCharacterEdit(request),{id}=await params;
    return json({character:await updateCharacter(id,edit)});
  });
}
