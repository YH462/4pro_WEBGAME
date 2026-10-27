import { Shell } from "@/components/shell";
import { RaidQrScanner } from "@/components/raid-qr-scanner";
import { currentPlayer } from "@/lib/session";
import { boss } from "@/lib/boss";
import { Swords, UsersRound } from "lucide-react";
import styles from "./battle.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "同期レイド" };
export default async function Battle() {
  const player = await currentPlayer();
  return <Shell active="/battle"><div className={styles.page}>
    <div className={`screen-heading ${styles.heading}`}><h1><Swords size={22}/>同期レイド</h1><span><UsersRound size={18}/>最大20人</span></div>
    <section className={styles.boss} aria-label="レイドのボス">
      <h2>{boss.name}</h2>
      <img src={boss.imageUrl} alt={boss.name} width={512} height={512}/>
    </section>
    <div className={styles.entry}>
      <p>会場のQRコードを読み取って参加</p>
      <RaidQrScanner hasPlayer={!!player} startHref="/start?next=battle"/>
    </div>
  </div></Shell>;
}
