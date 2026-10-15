import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { config } from "@/lib/config";
import { requirePlayer } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function Simulator() {
  if (!config().simulator) notFound();
  const player = await requirePlayer();
  return <Shell><div className="utility-screen"><div className="screen-heading"><div><span className="eyebrow">DEVELOPMENT TOOLS</span><h1>ローカルシミュレーター</h1></div></div><section className="simulator"><p>プレイヤーID：<code>{player.id}</code></p><p>別ゲストはシークレットウィンドウで作成できます。</p><strong>開発用所持データを作成</strong><pre>npm.cmd run simulator:grant -- {player.id} forest-golem</pre><p>実行後に図鑑を再読み込みしてください。これは表示検証用データで、NFC獲得・4プロ自動解放処理は準備中です。</p><Link className="button primary" href="/collection">図鑑で確認</Link><div className="simulator-links"><Link href="/api/health">DB疎通</Link><Link href="/api/me">ゲストAPI</Link><Link href="/api/characters">キャラAPI</Link></div></section></div></Shell>;
}
