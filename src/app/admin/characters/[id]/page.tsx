import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import { tagsForCharacter, acquisitionOrigins } from "@/lib/acquisition-tags";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminTagManager } from "@/components/admin/tag-manager";
import { AdminCharacterEditor } from "@/components/admin/character-editor";
import { AdminCharacterHintEditor } from "@/components/admin/character-hint-editor";
import { getCharacterHintEditorData } from "@/lib/character-hint-store";
import { characterImageUrl } from "@/lib/character-edit-input";
import { characterModelUrl } from "@/lib/character-models";
import styles from "@/components/admin/admin.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"キャラ編集・獲得タグ管理",referrer:"no-referrer" as const};
export default async function CharacterTags({params}:{params:Promise<{id:string}>}) {
  const admin=await currentAdmin();if(!admin)redirect("/admin/login");
  const {id}=await params;
  if(!await db.character.findUnique({where:{id},select:{id:true}}))notFound();
  const [{character,tags},event,hint]=await Promise.all([tagsForCharacter(id),db.event.findUnique({where:{id:config().EVENT_ID}}),getCharacterHintEditorData(id)]);
  return <div className={styles.adminPage}><AdminHeader username={admin.username}/><main className={styles.content}><Link href="/admin" className={styles.back}>← キャラクター一覧</Link><div className={styles.title}><h1>{character.name}</h1><p>{character.department?.name??(character.isLegendary?"条件達成で解放":"学科なし")} · {character.id}</p></div>{event?.status!=="ACTIVE"&&<p className={styles.event}>イベント終了中です。発行・再有効化はできません。</p>}<AdminCharacterHintEditor initial={hint}/><AdminCharacterEditor initial={{id:character.id,name:character.name,description:character.description,element:character.element as "FOREST"|"THUNDER"|"FLAME"|"AQUA"|"LEGEND",isDraft:character.isDraft,revision:character.revision,baseHp:character.baseHp,baseAttack:character.baseAttack,baseDefense:character.baseDefense,baseSpecialChargeRate:character.baseSpecialChargeRate,imageUrl:characterImageUrl(character.imageId),modelUrl:characterModelUrl(character.modelId),modelYaw:character.modelYaw,model:character.model}} fixedClassification={Boolean(character.departmentId)||character.isLegendary}/><AdminTagManager characterId={id} isLegendary={character.isLegendary} origins={acquisitionOrigins()} eventActive={event?.status==="ACTIVE"} tags={tags.map((tag)=>({id:tag.id,enabled:tag.enabled,createdAt:tag.createdAt.toISOString(),legacy:tag.characterId===null,acquisitions:tag._count.acquisitions}))}/></main></div>;
}
