import Link from "next/link";
import { ArrowRight, ScanLine, Sparkles, LockKeyhole } from "lucide-react";
import { Shell } from "@/components/shell";
import { ExhibitionMap } from "@/components/exhibition-map";
import { currentPlayer } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Home() {
  const player = await currentPlayer();
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true } });
  const collected = player?.characters.filter((owned) => !owned.character.isLegendary).length ?? 0;
  const legendOwned = player?.characters.some((owned) => owned.character.isLegendary);
  return <Shell><div className="home-screen">
    <div className="screen-heading"><div><span className="eyebrow">LET’S EXPLORE THE EXHIBITION</span><h1>{player ? `こんにちは、${player.nickname || "ゲスト"}さん。` : "4つの展示を、冒険しよう。"}</h1></div><span className="screen-code">HOME / 01</span></div>
    <div className="home-layout"><div className="home-brief">
      <section className="mission-panel"><span className="panel-label"><span className="signal-dot"/> YOUR MISSION</span><h2>めぐる。集める。<br/><em>みんなで挑む。</em></h2><p>4学科の展示で、<br/>あなたのパートナーを見つけよう。</p><div className="mission-divider"/>{player ? <div className="entry-ready"><ScanLine size={21}/><div><strong>展示から冒険をはじめよう</strong><span>NFC・QRによる獲得は準備中</span></div></div> : <Link className="button primary" href="/start">冒険をはじめる<ArrowRight size={18}/></Link>}<span className="mission-caption">4 DEPARTMENTS. INFINITE POSSIBILITIES.</span></section>
      <section className="collection-progress"><div><span className="eyebrow">COLLECTION PROGRESS</span><h2>学科パートナー</h2></div><strong>{collected}<small>/ 4</small></strong><div className="progress-segments" aria-label={`${collected}学科獲得`}>{[1, 2, 3, 4].map((number) => <span key={number} className={number <= collected ? "filled" : ""}/>)}</div><span className="progress-caption">全学科を集めて、伝説を解放。</span></section>
      <Link href={player ? "/collection/four-pro" : "/start"} className="legend-mini"><span className="legend-icon"><Sparkles size={22}/></span><div><span>LEGENDARY PARTNER</span><strong>4プロ<span>{legendOwned ? "獲得済み" : "全学科コンプリートで解放"}</span></strong></div>{legendOwned ? <ArrowRight size={17}/> : <LockKeyhole size={17}/>}</Link>
    </div><ExhibitionMap hasPlayer={!!player} partners={characters.filter((character) => !character.isLegendary).map((character) => ({ ...character, owned: player?.characters.some((item) => item.characterId === character.id) ?? false }))}/></div>
    <div className="home-ticker"><span>INFORMATION</span><p>展示で集めた仲間と、最大20人の協力レイドへ。</p><span className="ticker-tag">キャラ獲得・レイドは準備中</span></div>
  </div></Shell>;
}
