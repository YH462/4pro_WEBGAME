import { Shell } from "@/components/shell";
import { BattleConsole } from "@/components/battle/battle-console";
import { currentPlayer, requirePlayer } from "@/lib/session";
import { db } from "@/lib/db";
import { presentCharacter } from "@/lib/character-presentation";
import { LocalBattleConsole } from "@/components/battle/local-battle-console";
import { config } from "@/lib/config";
import { notFound, redirect } from "next/navigation";
import styles from "@/components/battle/raid-mobile.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "協力レイド" };
export default async function RaidPreview({ searchParams }: { searchParams: Promise<{ sync?: string }> }) {
  const local = (await searchParams).sync === "local";
  if (local && !config().simulator) notFound();
  const player = local ? await currentPlayer() : await requirePlayer();
  if (!player) redirect("/start?next=local-raid");
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true, skills: { where: { slot: 1 } } } });
  const ownedIds = new Set(player.characters.map((owned) => owned.characterId));
  const available = characters.filter((character) => ownedIds.size ? ownedIds.has(character.id) : !character.isLegendary && !character.isDraft);
  const partners = available.map((character) => presentCharacter(character, player.characters.find((owned) => owned.characterId === character.id)));
  return <Shell active="/battle"><div className={`battle-screen ${styles.page}`}><div className="screen-heading"><h1>レイドバトル</h1><span className={styles.badge}>{local ? "会場レイド" : "操作プレビュー"}</span></div>{local ? <LocalBattleConsole partners={partners}/> : <BattleConsole partners={partners}/>}</div></Shell>;
}
