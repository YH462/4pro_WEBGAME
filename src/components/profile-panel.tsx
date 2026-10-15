"use client";
import { useState } from "react";
import { UserRound, BookOpen, Trophy, Award, ShieldCheck } from "lucide-react";
import { GuestForm } from "./guest-form";

export function ProfilePanel({ id, nickname, count }: { id: string; nickname: string; count: number }) {
  const [tab, setTab] = useState("profile");
  return <section className="profile-panel"><div className="profile-identity"><span className="profile-avatar"><UserRound size={34}/></span><div><span className="eyebrow">EXHIBITION EXPLORER</span><h2>{nickname || "ゲスト"}</h2></div><span className="guest-badge"><ShieldCheck size={14}/> GUEST</span></div>
    <div className="panel-tabs" role="tablist" aria-label="プロフィールの表示"><button id="profile-tab" type="button" role="tab" aria-selected={tab === "profile"} aria-controls="profile-content" onClick={() => setTab("profile")}>プロフィール</button><button id="records-tab" type="button" role="tab" aria-selected={tab === "records"} aria-controls="profile-content" onClick={() => setTab("records")}>冒険の記録</button></div>
    <div id="profile-content" className="profile-content" role="tabpanel" aria-labelledby={tab === "profile" ? "profile-tab" : "records-tab"}>
      {tab === "profile" ? <><GuestForm mode="edit" initialNickname={nickname}/><div className="player-id"><span>PLAYER ID</span><code>{id}</code></div><p className="privacy-note">Cookieを削除すると進行状況を引き継げません。</p></> : <div className="record-content"><div className="record-stats"><div><BookOpen size={25}/><strong>{count}<small> / 5</small></strong><span>パートナー</span></div><div><Trophy size={25}/><strong>—</strong><span>討伐記録</span></div><div><Award size={25}/><strong>—</strong><span>称号・バッジ</span></div></div><p>討伐記録と称号・バッジは準備中です。<br/>まずは展示のパートナーに会いにいこう。</p></div>}
    </div></section>;
}
