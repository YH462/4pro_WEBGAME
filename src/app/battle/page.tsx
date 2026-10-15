import { Shell } from "@/components/shell";
import { BattleConsole } from "@/components/battle/battle-console";
import { requirePlayer } from "@/lib/session";
import { db } from "@/lib/db";
import { presentCharacter } from "@/lib/character-presentation";

export const dynamic = "force-dynamic";
export const metadata = { title: "協力レイド" };
export default async function Battle() {
  const player = await requirePlayer();
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true, skills: { orderBy: { slot: "asc" } } } });
  const ownedIds = new Set(player.characters.map((owned) => owned.characterId));
  // Unowned normal characters are available only as UI preview specimens.
  // This never grants ownership, starts a raid or changes progression.
  const available = characters.filter((character) => ownedIds.size ? ownedIds.has(character.id) : !character.isLegendary);
  const partners = available.map((character) => presentCharacter(character, player.characters.find((owned) => owned.characterId === character.id)));
  return <Shell active="/battle"><div className="battle-screen"><div className="screen-heading"><div><span className="eyebrow">CO-OP RAID BATTLE</span><h1>バトル</h1></div><span className="battle-preview-label">操作体験 · 戦闘は準備中</span></div><BattleConsole partners={partners}/></div></Shell>;
}
