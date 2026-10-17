"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, Swords, Sparkles, Shield, Zap, UsersRound, Check, ChevronDown, Radio } from "lucide-react";
import type { PartnerView } from "@/lib/character-presentation";
import { battlePreview as preview } from "@/lib/battle-preview";
import { CharacterArt } from "../character-art";
import { ArenaScene } from "./arena-scene";
import "./battle.css";

export function BattleConsole({ partners }: { partners: PartnerView[] }) {
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [action, setAction] = useState<"attack" | "defend" | "special">("attack");
  const [animationId, setAnimationId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("攻撃・防御・必殺から選んで、演出を試そう。");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const partner = partners.find((item) => item.id === partnerId) ?? partners[0];
  if (!partner) return <div className="empty-panel">キャラクター情報を準備しています。</div>;
  const actions = [
    { id: "attack", name: "攻撃", description: "敵を攻撃する", icon: Swords },
    { id: "defend", name: "防御", description: "身を守る", icon: Shield },
    { id: "special", name: "必殺", description: partner.specialMove?.confirmed ? partner.specialMove.name : "効果・消費EPは準備中", icon: Sparkles },
  ] as const;
  const selected = actions.find((item) => item.id === action)!;
  const hp = partner.stats[0].value;

  return <div className="raid-console">
    <section className={`enemy-field ${busy && action !== "defend" ? "is-attacking" : ""}`} aria-label="敵画面">
      <div className="enemy-hud"><div className="boss-status"><span className="boss-type"><span className="signal-dot"/> RAID BOSS / 01</span><h2>{preview.bossName}</h2><div className="boss-health-label"><span>HP</span><strong>{preview.bossHp}<small> / {preview.bossHp}</small></strong></div><div className="boss-health" role="progressbar" aria-label="ボスHP（プレビュー）" aria-valuenow={preview.bossHp} aria-valuemin={0} aria-valuemax={preview.bossHp}><span/></div></div><div className="raid-turn"><span>TURN</span><strong>01<small> / {preview.maxTurns}</small></strong><span className="raid-waiting">未開始</span></div></div>
      <div className="enemy-viewport"><ArenaScene animationId={animationId}/><div className="target-frame" aria-hidden="true"><i/><i/><i/><i/></div><div className="attack-beam" aria-hidden="true"/></div>
      <div className="enemy-bottom"><span><UsersRound size={13}/>参加人数 <strong>— / 20</strong></span><span className="target-label"><Crosshair size={12}/>TARGET LOCKED</span><span><Radio size={11}/> 操作プレビュー</span></div>
    </section>

    <section className="raid-controls" aria-label="スマホ操作画面">
      <div className="player-hud"><span className={`player-portrait element-${partner.element.toLowerCase()}`}><CharacterArt element={partner.element} locked={!partner.owned}/>{busy && action === "defend" && <Shield className="defense-preview" aria-label="防御の演出"/>}</span><div className="player-vitals"><div className="player-select"><label className="sr-only" htmlFor="battle-partner">参加キャラクター</label><select id="battle-partner" value={partner.id} disabled={busy} onChange={(event) => { setPartnerId(event.target.value); setAction("attack"); setFeedback("攻撃・防御・必殺から選んで、演出を試そう。"); }}>{partners.map((item) => <option value={item.id} key={item.id}>{item.name}{item.owned ? "" : "（体験）"}</option>)}</select><ChevronDown size={13}/></div><div className="player-health"><span>HP</span><div role="progressbar" aria-label="自分のHP（プレビュー）" aria-valuemin={0} aria-valuemax={hp} aria-valuenow={hp}><span/></div><strong>{hp}<small> / {hp}</small></strong></div></div><div className="player-ep"><span><Zap size={11}/> 必殺（EP）</span><strong>{preview.initialEp}<small> / {preview.maxEp}</small></strong><div className="ep-gauge" role="progressbar" aria-label="必殺ゲージ（EP・プレビュー）" aria-valuemin={0} aria-valuemax={preview.maxEp} aria-valuenow={preview.initialEp}><span style={{ width: `${preview.initialEp / preview.maxEp * 100}%` }}/></div></div></div>
      <div className="raid-skills" role="group" aria-label="行動を選ぶ">{actions.map((item, index) => { const Icon = item.icon; return <button type="button" key={item.id} className={`raid-skill ${action === item.id ? "chosen" : ""}`} aria-pressed={action === item.id} aria-label={`${item.name}を選択`} disabled={busy} onClick={() => { setAction(item.id); setFeedback(`${item.name}を選択しました。`); }}><span className="skill-topline"><span>0{index + 1}</span>{action === item.id && <Check size={12}/>}</span><Icon className="skill-symbol" size={24}/><strong>{item.name}</strong><span className="skill-bottomline">{item.description}</span></button>; })}</div>
      <p className="raid-feedback" role="status" aria-live="polite">{feedback}</p>
      <button type="button" className="raid-confirm" disabled={busy} aria-busy={busy} onClick={() => {
        if (busy) return;
        setBusy(true); if (action !== "defend") setAnimationId((value) => value + 1); setFeedback(`${selected.name}の演出を表示しています。`);
        timer.current = setTimeout(() => { setBusy(false); setFeedback(`${selected.name}の演出を確認しました。`); timer.current = null; }, preview.animationMs);
      }}><span className="confirm-selection"><span>SELECTED COMMAND</span><strong>{selected.name}</strong></span><span className="confirm-action">{busy ? "演出中…" : "演出を試す"}<Swords size={23}/></span></button>
    </section>
  </div>;
}
