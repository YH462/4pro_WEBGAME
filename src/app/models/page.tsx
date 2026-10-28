import Link from "next/link";
import { ModelMotionPreview } from "@/components/battle/model-motion-preview";
import { characterMotionsForModel } from "@/lib/character-motion-catalog";
import { characterModels, characterModelUrl } from "@/lib/character-models";
import { db } from "@/lib/db";
import styles from "./models.module.css";

export const metadata = { title: "3Dモデル確認" };
export const dynamic = "force-dynamic";

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ character?: string }> }) {
  const { character } = await searchParams;
  const characters=await db.character.findMany({where:{modelId:{not:null},...(character?{id:character}:{})},include:{department:true},orderBy:{sortOrder:"asc"}});
  const motions=Object.fromEntries(await Promise.all(characters.map(async c=>[c.id,await characterMotionsForModel(c.id,c.modelId,c.modelYaw)])));
  return <main className={styles.page}>
    <header><Link href="/">← ゲームへ</Link><h1>3Dモデル確認</h1></header>
    <div className={styles.grid}>{characters.map((character) => {
      const id=character.id, known=characterModels[id as keyof typeof characterModels];
      const asset={code:known?.code??String(character.sortOrder),department:character.department?.name??character.name,url:characterModelUrl(character.modelId)!,yaw:character.modelYaw*Math.PI/180,motions:motions[id]};
      return <section className={styles.card} key={id} aria-label={`${asset.code}：${asset.department}`}>
        <h2><span>{asset.code}</span>{asset.department}</h2>

        <ModelMotionPreview element={character.element} characterId={id} name={asset.department} model={asset}/>
        <a href={asset.url} download>{character.departmentId?`${asset.code}科`:character.name}のGLBをダウンロード</a>
      </section>;
    })}</div>

  </main>;
}
