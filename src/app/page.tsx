import { Megaphone } from "lucide-react";
import { Shell } from "@/components/shell";
import { ExhibitionMap } from "@/components/exhibition-map";
import { RaidQrScanner } from "@/components/raid-qr-scanner";
import { currentPlayer } from "@/lib/session";
import { db } from "@/lib/db";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export default async function Home() {
  const player = await currentPlayer();
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true } });
  const partners = characters.map((character) => ({
    ...character,
    owned: player?.characters.some((item) => item.characterId === character.id) ?? false,
  }));
  return (
    <Shell>
      <div className={styles.screen}>
        <section className={styles.notice} aria-labelledby="home-notice-title">
          <h1 id="home-notice-title"><Megaphone size={18}/>お知らせ</h1>
          <p>図鑑・プロフィール・CPU対戦を利用できます。<span>獲得・育成・レイドは準備中です。</span></p>
        </section>
        <ExhibitionMap
          hasPlayer={!!player}
          partners={partners.filter((partner) => !partner.isLegendary)}
          legend={partners.find((partner) => partner.id === "four-pro")}
        />
        <RaidQrScanner hasPlayer={!!player}/>
      </div>
    </Shell>
  );
}
