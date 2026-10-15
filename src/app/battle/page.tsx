import Link from "next/link";
import { Swords, UsersRound, Timer, QrCode, ArrowLeft, LockKeyhole } from "lucide-react";
import { Shell } from "@/components/shell";
import { CharacterArt } from "@/components/character-art";
import { requirePlayer } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "協力レイド" };
export default async function Battle() {
  await requirePlayer();
  return <Shell active="/battle"><div className="battle-screen"><div className="screen-heading"><div><span className="eyebrow">UNITE YOUR POWER</span><h1>協力レイド</h1></div><span className="screen-code">BATTLE / 03</span></div><section className="battle-panel"><div className="battle-poster"><span className="panel-label">CO-OP RAID BATTLE</span><div className="boss-ring"/><CharacterArt element="FLAME"/><span className="boss-caption">TOGETHER, WE ARE STRONGER.</span></div><div className="battle-info"><span className="battle-tag"><LockKeyhole size={13}/> COMING SOON</span><h2>ひとりの冒険が、<br/><em>みんなの力に。</em></h2><p>育てたパートナーと、会場のボスに挑もう。</p><div className="battle-specs"><span><UsersRound size={18}/>最大20人</span><span><Timer size={18}/>最大5分</span><span><Swords size={18}/>10ターン</span></div><div className="raid-notice"><QrCode size={30}/><div><strong>レイド受付は準備中です</strong><p>実装後は会場の専用QRから参加できます。</p></div></div><Link href="/" className="button primary"><ArrowLeft size={17}/>展示マップに戻る</Link></div></section></div></Shell>;
}
