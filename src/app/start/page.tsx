import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { GuestForm } from "@/components/guest-form";
import { CharacterArt } from "@/components/character-art";
import { currentPlayer } from "@/lib/session";
import { startDestination } from "@/lib/acquisition-links";
import { UserRound } from "lucide-react";
import styles from "./start.module.css";
export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };
export default async function Start({ searchParams }: { searchParams: Promise<{ next?: string | string[]; tag?: string | string[]; room?: string | string[] }> }) {
  const destination = startDestination(await searchParams);
  if (await currentPlayer()) redirect(destination);
  return <Shell><div className={styles.screen}>
    <section className={styles.story} aria-labelledby="entry-story-title">
      <div className={styles.copy}>

        <h1 id="entry-story-title">きょうの発見を、<br/><em>仲間にしよう。</em></h1>


      </div>
      <div className={styles.partners} aria-hidden="true">{["FOREST", "THUNDER", "FLAME", "AQUA"].map(element => <div key={element} className={styles.partner}><CharacterArt element={element} portrait/></div>)}</div>
    </section>
    <section className={styles.entry} aria-labelledby="player-entry-title">
      <div className={styles.decoration} aria-hidden="true"><UserRound size={25}/></div>

      <h2 id="player-entry-title">冒険の準備</h2>

      <GuestForm destination={destination} className={styles.form}/>

    </section>
  </div></Shell>;
}
