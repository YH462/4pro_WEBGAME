import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { GuestForm } from "@/components/guest-form";
import { CharacterArt } from "@/components/character-art";
import { currentPlayer } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function Start() {
  if (await currentPlayer()) redirect("/");
  return <Shell><div className="start-screen"><div className="start-story"><span className="eyebrow">YOUR NEXT ADVENTURE</span><h1>きょうの発見を、<br/><em>仲間にしよう。</em></h1><p>4学科の力が、ひとつになる。<br/>スマホひとつで展示を冒険しよう。</p><div className="entry-partners"><CharacterArt element="FOREST"/><CharacterArt element="THUNDER"/><CharacterArt element="FLAME"/><CharacterArt element="AQUA"/></div><span className="story-caption">EXPLORE. COLLECT. TEAM UP.</span></div><section className="entry-panel"><span className="panel-label">PLAYER ENTRY / 01</span><h2>冒険の準備</h2><p>呼んでほしい名前を教えてください。</p><GuestForm/><div className="privacy-note">登録・パスワードは不要です。<br/>Cookie削除・端末変更では進行状況を引き継げません。</div></section></div></Shell>;
}
