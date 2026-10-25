import Link from "next/link";
import { PartnerScene } from "@/components/battle/partner-scene";
import { characterModels, characterModelUrl } from "@/lib/character-models";
import { db } from "@/lib/db";
import styles from "./models.module.css";

export const metadata = { title: "3Dモデル確認" };
export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const characters=await db.character.findMany({where:{modelId:{not:null}},include:{department:true},orderBy:{sortOrder:"asc"}});
  return <main className={styles.page}>
    <header><Link href="/">← ゲームへ</Link><h1>3Dモデル確認</h1><p>学科キャラと学科に所属しないキャラを、ゲームと同じ描画で確認できます。</p></header>
    <div className={styles.grid}>{characters.map((character) => {
      const id=character.id, known=characterModels[id as keyof typeof characterModels];
      const asset={code:known?.code??String(character.sortOrder),department:character.department?.name??character.name,url:characterModelUrl(character.modelId)!,yaw:character.modelYaw*Math.PI/180};
      return <section className={styles.card} key={id} aria-label={`${asset.code}：${asset.department}`}>
        <h2><span>{asset.code}</span>{asset.department}</h2>
        {!character.departmentId&&<p className={styles.category}>学科なし</p>}
        <div className={styles.stage} role="img" aria-label={`${asset.department}の3Dモデル`}><PartnerScene element={character.element} characterId={id} model={asset}/></div>
        <a href={asset.url} download>{character.departmentId?`${asset.code}科`:character.name}のGLBをダウンロード</a>
      </section>;
    })}</div>
    <p className={styles.note}>モデルの準備ができるまで読み込み表示になります。読み込み失敗時は仮モデル、WebGL非対応時は簡易イラストを表示します。キャラ名・紹介文・能力は管理画面で変更できます。キャラ画像はモデルから自動作成します。</p>
  </main>;
}
