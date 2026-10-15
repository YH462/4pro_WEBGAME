"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, Swords, Sparkles, Hexagon, Zap, UsersRound, Check, ChevronDown, Radio } from "lucide-react";
import type { PartnerView } from "@/lib/character-presentation";
import { battlePreview as preview } from "@/lib/battle-preview";
import { CharacterArt } from "../character-art";
import { ArenaScene } from "./arena-scene";
import "./battle.css";

export function BattleConsole({ partners }: { partners: PartnerView[] }) {
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [slot, setSlot] = useState(1);
  const [animationId, setAnimationId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("技を選んで、攻撃演出を試そう。");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const partner = partners.find((item) => item.id === partnerId) ?? partners[0];
  if (!partner) return <div className="empty-panel">キャラクター情報を準備しています。</div>;
  const skills = [1, 2, 3].map((number) => {
    const skill = partner.skills.find((item) => item.slot === number);
    return { slot: number, name: skill?.confirmed ? skill.name : `固有技 ${number}`, confirmed: skill?.confirmed ?? false };
  });
  const selected = skills.find((skill) => skill.slot === slot)!;
  const skillIcons = [Crosshair, Hexagon, Sparkles];
  const hp = partner.stats[0].value;

  return <div className="raid-console">
    <section className={`enemy-field ${busy ? "is-attacking" : ""}`} aria-label="敵画面">
      <div className="enemy-hud"><div className="boss-status"><span className="boss-type"><span className="signal-dot"/> RAID BOSS / 01</span><h2>{preview.bossName}</h2><div className="boss-health-label"><span>HP</span><strong>{preview.bossHp}<small> / {preview.bossHp}</small></strong></div><div className="boss-health" role="progressbar" aria-label="ボスHP（プレビュー）" aria-valuenow={preview.bossHp} aria-valuemin={0} aria-valuemax={preview.bossHp}><span/></div></div><div className="raid-turn"><span>TURN</span><strong>01<small> / {preview.maxTurns}</small></strong><span className="raid-waiting">未開始</span></div></div>
      <div className="enemy-viewport"><ArenaScene animationId={animationId}/><div className="target-frame" aria-hidden="true"><i/><i/><i/><i/></div><div className="attack-beam" aria-hidden="true"/></div>
      <div className="enemy-bottom"><span><UsersRound size={13}/>参加人数 <strong>— / 20</strong></span><span className="target-label"><Crosshair size={12}/>TARGET LOCKED</span><span><Radio size={11}/> 操作プレビュー</span></div>
    </section>

    <section className="raid-controls" aria-label="スマホ操作画面">
      <div className="player-hud"><span className={`player-portrait element-${partner.element.toLowerCase()}`}><CharacterArt element={partner.element}/></span><div className="player-vitals"><div className="player-select"><label className="sr-only" htmlFor="battle-partner">参加キャラクター</label><select id="battle-partner" value={partner.id} disabled={busy} onChange={(event) => { setPartnerId(event.target.value); setSlot(1); setFeedback("技を選んで、攻撃演出を試そう。"); }}>{partners.map((item) => <option value={item.id} key={item.id}>{item.name}{item.owned ? "" : "（体験）"}</option>)}</select><ChevronDown size={13}/></div><div className="player-health"><span>HP</span><div role="progressbar" aria-label="自分のHP（プレビュー）" aria-valuemin={0} aria-valuemax={hp} aria-valuenow={hp}><span/></div><strong>{hp}<small> / {hp}</small></strong></div></div><div className="player-ep"><span><Zap size={11}/> EP</span><strong>{preview.initialEp}<small> / {preview.maxEp}</small></strong></div></div>
      <div className="raid-skills" role="group" aria-label="使用する技">{skills.map((skill, index) => { const Icon = skillIcons[index]; return <button type="button" key={skill.slot} className={`raid-skill ${slot === skill.slot ? "chosen" : ""}`} aria-pressed={slot === skill.slot} aria-label={`${skill.name}を選択`} disabled={busy} onClick={() => { setSlot(skill.slot); setFeedback(`${skill.name}を選択しました。`); }}><span className="skill-topline"><span>SKILL 0{skill.slot}</span>{slot === skill.slot ? <Check size={12}/> : <span>EP —</span>}</span><Icon className="skill-symbol" size={24}/><strong>{skill.name}</strong><span className="skill-bottomline">{skill.confirmed ? "効果の接続待ち" : "効果は準備中"}</span></button>; })}</div>
      <p className="raid-feedback" role="status" aria-live="polite">{feedback}</p>
      <button type="button" className="raid-confirm" disabled={busy} aria-busy={busy} onClick={() => {
        if (busy) return;
        setBusy(true); setAnimationId((value) => value + 1); setFeedback(`${selected.name}の攻撃演出を表示しています。`);
        timer.current = setTimeout(() => { setBusy(false); setFeedback(`${selected.name}の演出を確認しました。`); timer.current = null; }, preview.animationMs);
      }}><span className="confirm-selection"><span>SELECTED COMMAND</span><strong>{selected.name}</strong></span><span className="confirm-action">{busy ? "演出中…" : "演出を試す"}<Swords size={23}/></span></button>
    </section>
  </div>;
}
