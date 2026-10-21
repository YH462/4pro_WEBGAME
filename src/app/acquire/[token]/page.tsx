import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { AcquisitionPanel } from "@/components/acquisition-panel";
import { acquisitionTag } from "@/lib/acquisition";
import { currentPlayer } from "@/lib/session";
export const dynamic = "force-dynamic";
export const metadata = { title: "展示のパートナー", referrer: "no-referrer" as const };
export default async function Acquire({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tag = await acquisitionTag(token);
  if (!tag) return <Shell active="/collection"><section className="entry-panel"><h1>この展示のリンクは利用できません</h1><p>展示のタグをもう一度タッチするか、展示スタッフに確認してください。</p><Link href="/" className="button">ホームへ戻る</Link></section></Shell>;
  const player = await currentPlayer();
  if (!player) redirect(`/start?next=acquire&tag=${token}`);
  const character = tag.department.character!;
  return <Shell active="/collection"><AcquisitionPanel token={token} department={tag.department.name} character={{ id: character.id, name: character.name, element: character.element }} owned={player.characters.some((item) => item.characterId === character.id)}/></Shell>;
}
