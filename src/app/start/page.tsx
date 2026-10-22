import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { GuestForm } from "@/components/guest-form";
import { CharacterArt } from "@/components/character-art";
import { currentPlayer } from "@/lib/session";
import { startDestination } from "@/lib/acquisition-links";
import { LockKeyhole, UserRound } from "lucide-react";
import styles from "./start.module.css";
export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };
export default async function Start({ searchParams }: { searchParams: Promise<{ next?: string | string[]; tag?: string | string[] }> }) {
  const destination = startDestination(await searchParams);
  if (await currentPlayer()) redirect(destination);
  return <Shell><div className={styles.screen}>
    <section className={styles.story} aria-labelledby="entry-story-title">
      <div className={styles.copy}>
        <span className={styles.eyebrow}>YOUR NEXT ADVENTURE</span>
        <h1 id="entry-story-title">きょうの発見を、<br/><em>仲間にしよう。</em></h1>
        <p>展示やミニゲームで出会える<br/>個性豊かなキャラクターたち。<br/>集めて、育てて、みんなで挑もう。</p>
        <span className={styles.caption}>EXPLORE. COLLECT. TEAM UP.</span>
      </div>
      <div className={styles.partners} aria-hidden="true">{["FOREST", "THUNDER", "FLAME", "AQUA"].map(element => <div key={element} className={styles.partner}><CharacterArt element={element} portrait/></div>)}</div>
    </section>
    <section className={styles.entry} aria-labelledby="player-entry-title">
      <div className={styles.decoration} aria-hidden="true"><UserRound size={25}/></div>
      <span className={styles.label}>PLAYER ENTRY / 01</span>
      <h2 id="player-entry-title">冒険の準備</h2>
      <p className={styles.introduction}>呼んでほしい名前を入力してください。<br/>あとから変更できます。</p>
      <GuestForm destination={destination} className={styles.form}/>
      <div className={styles.privacy}><LockKeyhole size={20} aria-hidden="true"/><p>会員登録・パスワードは不要です。<br/>Cookieの削除・端末変更では進行状況を引き継げません。</p></div>
    </section>
  </div></Shell>;
}
