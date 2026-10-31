import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { CharacterLocationHint } from "@/components/character-location-hint";
import { getCharacterLocationHint } from "@/lib/character-hint-store";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "キャラクターの場所のヒント" };

export default async function CharacterHintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [character, player] = await Promise.all([
    db.character.findUnique({ where: { id }, select: { id: true, name: true, sortOrder: true, departmentId: true } }),
    currentPlayer(),
  ]);
  if (!character) notFound();
  if (player?.characters.some(owned => owned.characterId === character.id)) redirect(`/collection/${encodeURIComponent(character.id)}`);
  return <Shell active="/collection"><CharacterLocationHint name={character.name} number={character.sortOrder} hint={await getCharacterLocationHint(character)}/></Shell>;
}
