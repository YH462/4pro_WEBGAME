import { redirect } from "next/navigation";
import { currentAdmin } from "./admin-session";
import { db } from "./db";
import { presentCharacter } from "./character-presentation";

/** Display-only unlock: no Player, ownership, achievements or raid mutations. */
export async function adminPreviewCharacters(){
  if(!await currentAdmin())redirect("/admin/login?next=preview");
  const characters=await db.character.findMany({orderBy:{sortOrder:"asc"},include:{department:true,skills:{where:{slot:1}}}});
  return {characters,partners:characters.map(character=>({...presentCharacter(character),owned:true}))};
}
