import { notFound, redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { getCharacterLocationHint } from "@/lib/character-hint-store";
import { Shell } from "@/components/shell";
import { CharacterLocationHint } from "@/components/character-location-hint";

export const dynamic = "force-dynamic";
export default async function HintPreview({ params }: { params: Promise<{ id: string }> }) {
  if (!await currentAdmin()) redirect("/admin/login");
  const { id } = await params;
  const character = await db.character.findUnique({ where: { id }, select: { id: true, name: true, sortOrder: true, departmentId: true } });
  if (!character) notFound();
  return <Shell preview active="/admin/preview/collection"><CharacterLocationHint name={character.name} number={character.sortOrder} hint={await getCharacterLocationHint(character)} backHref={`/admin/characters/${encodeURIComponent(id)}#location-hint-editor`} backLabel="キャラ編集に戻る"/></Shell>;
}
