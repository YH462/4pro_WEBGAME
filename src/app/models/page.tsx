import Link from "next/link";
import { PartnerScene } from "@/components/battle/partner-scene";
import { characterModels } from "@/lib/character-models";
import { characters } from "@/lib/master-data";
import styles from "./models.module.css";

export const metadata = { title: "3Dモデル確認" };

export default function ModelsPage() {
  return <main className={styles.page}>
    <header><Link href="/">← ゲームへ</Link><h1>3Dモデル確認</h1><p>Blenderから書き出した4学科のモデルです。正面・全身をゲームと同じ描画で確認できます。</p></header>
    <div className={styles.grid}>{Object.entries(characterModels).map(([id, asset]) => {
      const character = characters.find((item) => item.id === id)!;
      return <section className={styles.card} key={id} aria-label={`${asset.code}：${asset.department}`}>
        <h2><span>{asset.code}</span>{asset.department}</h2>
        <div className={styles.stage} role="img" aria-label={`${asset.department}の3Dモデル`}><PartnerScene element={character.element} characterId={id}/></div>
        <a href={asset.url} download>{asset.code}科のGLBをダウンロード</a>
      </section>;
    })}</div>
    <p className={styles.note}>モデルの準備ができるまで読み込み表示になります。読み込み失敗時は仮モデル、WebGL非対応時は簡易イラストを表示します。キャラ名・能力・図鑑の画像は管理画面から別途設定できます。</p>
  </main>;
}
