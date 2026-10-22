import { Shell } from "@/components/shell";
import { PartnerCollection } from "@/components/partner-collection";
import { presentCharacter } from "@/lib/character-presentation";
import { requirePlayer } from "@/lib/session";
import { db } from "@/lib/db";
import styles from "./collection.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "キャラ図鑑" };
export default async function Collection() {
  const player = await requirePlayer();
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true, skills: { where: { slot: 1 } } } });
  const partners = characters.map((character) => presentCharacter(character, player.characters.find((item) => item.characterId === character.id)));
  const ownedCount = partners.filter((partner) => partner.owned).length;
  const progress = characters.length ? ownedCount / characters.length * 100 : 0;
  return <Shell active="/collection"><div className={styles.screen}>
    <header className={styles.heading}>
      <div className={styles.title}><span>PARTNER COLLECTION</span><h1>キャラ図鑑</h1></div>
      <div className={styles.progress} role="progressbar" aria-label="キャラクター獲得進捗" aria-valuemin={0} aria-valuemax={Math.max(1, characters.length)} aria-valuenow={ownedCount} aria-valuetext={`${ownedCount} / ${characters.length} 体獲得`}>
        <div className={styles.count}><strong>{ownedCount}</strong><span>/ {characters.length}</span><small>体獲得</small></div>
        <div className={styles.track} aria-hidden="true"><span style={{ width: `${progress}%` }}/></div>
      </div>
    </header>
    <PartnerCollection partners={partners}/>
  </div></Shell>;
}
