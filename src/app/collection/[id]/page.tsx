import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { PartnerPanel } from "@/components/partner-panel";
import { presentCharacter } from "@/lib/character-presentation";
import { currentPlayer } from "@/lib/session";
import { db } from "@/lib/db";
import styles from "@/components/partner-panel.module.css";
export const dynamic = "force-dynamic";
export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer();
  const { id } = await params;
  const character = await db.character.findUnique({ where: { id }, include: { department: true, skills: { where: { slot: 1 } } } });
  if (!character) notFound();
  const [previous, next] = await Promise.all([
    db.character.findFirst({ where: { sortOrder: { lt: character.sortOrder } }, orderBy: { sortOrder: "desc" }, select: { id: true, name: true, sortOrder: true } }),
    db.character.findFirst({ where: { sortOrder: { gt: character.sortOrder } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sortOrder: true } }),
  ]);
  const owned = player?.characters.find((item) => item.characterId === character.id);
  return <Shell active="/collection"><div className="detail-screen"><div className={styles.heading}>
    <Link href="/collection"><ArrowLeft size={20}/>図鑑に戻る</Link>
    <nav className={styles.characterNavigation} aria-label="キャラクターの切り替え">
      {previous ? <Link href={`/collection/${previous.id}`} aria-label={`前のキャラクター：No. ${String(previous.sortOrder).padStart(3, "0")} ${previous.name}`}><ChevronLeft size={22}/></Link> : <button type="button" disabled aria-label="前のキャラクター"><ChevronLeft size={22}/></button>}
      {next ? <Link href={`/collection/${next.id}`} aria-label={`次のキャラクター：No. ${String(next.sortOrder).padStart(3, "0")} ${next.name}`}><ChevronRight size={22}/></Link> : <button type="button" disabled aria-label="次のキャラクター"><ChevronRight size={22}/></button>}
    </nav>
  </div><PartnerPanel partner={presentCharacter(character, owned)} previous={previous} next={next}/></div></Shell>;
}
