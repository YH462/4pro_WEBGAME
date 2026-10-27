import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { characterImageUrl } from "@/lib/character-edit-input";
import { config } from "@/lib/config";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminCharacterList } from "@/components/admin/character-list";
import styles from "@/components/admin/admin.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"キャラクター管理",referrer:"no-referrer" as const};
export default async function Admin() {
  const admin=await currentAdmin();if(!admin)redirect("/admin/login");
  const eventId=config().EVENT_ID;
  const [characters,tags,event]=await Promise.all([db.character.findMany({orderBy:{sortOrder:"asc"},include:{department:true,_count:{select:{owners:{where:{player:{eventId}}}}}}}),db.acquisitionTag.findMany({where:{eventId},select:{characterId:true,departmentId:true,enabled:true}}),db.event.findUnique({where:{id:eventId}})]);
  const rows=characters.map((character)=>{const mine=tags.filter((tag)=>tag.characterId===character.id||tag.characterId===null&&tag.departmentId!==null&&tag.departmentId===character.departmentId);return {id:character.id,name:character.name,element:character.element,imageUrl:characterImageUrl(character.imageId),department:character.department?.name??null,isLegendary:character.isLegendary,owners:character._count.owners,tags:mine.length,enabledTags:mine.filter((tag)=>tag.enabled).length};});
  return <div className={styles.adminPage}><AdminHeader username={admin.username}/><main className={styles.content}><div className={styles.title}><h1>キャラクター管理</h1></div><div className={styles.event}>{event?.name??eventId} · {event?.status==="ACTIVE"?"開催中":"終了・未設定"}</div><div className={styles.summary}><span>登録キャラ<b>{characters.length}</b></span><span>学科キャラ<b>{characters.filter((item)=>item.departmentId).length}</b></span><span>有効タグ<b>{tags.filter((tag)=>tag.enabled).length}</b></span></div><AdminCharacterList characters={rows}/></main></div>;
}
