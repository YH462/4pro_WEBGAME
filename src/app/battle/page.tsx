import { Shell } from "@/components/shell";
import { CpuBattleConsole } from "@/components/battle/cpu-battle-console";
import { requirePlayer } from "@/lib/session";
import { db } from "@/lib/db";
import { presentCharacter } from "@/lib/character-presentation";

export const dynamic = "force-dynamic";
export const metadata = { title: "CPU対戦" };
export default async function Battle() {
  const player = await requirePlayer();
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true, skills: { where: { slot: 1 } } } });
  const partners = characters.map((character) => presentCharacter(character, player.characters.find((owned) => owned.characterId === character.id)));
  return <Shell active="/battle"><CpuBattleConsole partners={partners}/></Shell>;
}
