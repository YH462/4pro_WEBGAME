import { Shell } from "@/components/shell";
import { PartnerCollection } from "@/components/partner-collection";
import { presentCharacter } from "@/lib/character-presentation";
import { requirePlayer } from "@/lib/session";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = { title: "キャラ図鑑" };
export default async function Collection() {
  const player = await requirePlayer();
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true, skills: { orderBy: { slot: "asc" } } } });
  const partners = characters.map((character) => presentCharacter(character, player.characters.find((item) => item.characterId === character.id)));
  return <Shell active="/collection"><div className="collection-screen"><div className="screen-heading"><div><span className="eyebrow">PARTNER COLLECTION</span><h1>キャラ図鑑</h1></div><span className="collection-count">{player.characters.length}<small> / {characters.length} 体獲得</small></span></div><PartnerCollection partners={partners}/></div></Shell>;
}
