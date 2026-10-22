import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { PartnerPanel } from "@/components/partner-panel";
import { presentCharacter } from "@/lib/character-presentation";
import { requirePlayer } from "@/lib/session";
import { db } from "@/lib/db";
import styles from "@/components/partner-panel.module.css";
export const dynamic = "force-dynamic";
export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const player = await requirePlayer();
  const { id } = await params;
  const character = await db.character.findUnique({ where: { id }, include: { department: true, skills: { where: { slot: 1 } } } });
  if (!character) notFound();
  const owned = player.characters.find((item) => item.characterId === character.id);
  return <Shell active="/collection"><div className="detail-screen"><div className={styles.heading}><Link href="/collection"><ArrowLeft size={20}/>図鑑に戻る</Link><span>PARTNER / {String(character.sortOrder).padStart(2, "0")}</span></div><PartnerPanel partner={presentCharacter(character, owned)}/></div></Shell>;
}
