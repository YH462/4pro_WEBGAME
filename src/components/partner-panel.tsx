"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { Heart, Swords, Shield, Zap, Check, LockKeyhole, ArrowUpRight, ScanLine } from "lucide-react";
import { CharacterArt } from "./character-art";
import type { PartnerView } from "@/lib/character-presentation";

const tabs = [{ id: "stats", label: "ステータス" }, { id: "skills", label: "固有技" }, { id: "about", label: "紹介" }] as const;
export function PartnerPanel({ partner, detail = false }: { partner: PartnerView; detail?: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("stats");
  const id = useId();
  const Heading = detail ? "h1" : "h2";
  const icons = [Heart, Swords, Shield, Zap];
  return <section className={`partner-panel element-${partner.element.toLowerCase()}`} aria-label={partner.name}>
    <div className="partner-portrait"><span className="portrait-number">No. {String(partner.number).padStart(3, "0")}</span><div className="portrait-orbit"/><div className="portrait-crosshair"/><CharacterArt element={partner.element} className="partner-art"/><span className={`owned-tag ${partner.owned ? "owned" : ""}`}>{partner.owned ? <><Check size={13}/>獲得済み</> : <><LockKeyhole size={13}/>未獲得</>}</span><span className="portrait-element">{partner.element}</span></div>
    <div className="partner-data"><div className="partner-title"><span className="department-label">{partner.department}</span><Heading>{partner.name}</Heading><span className="partner-rarity">{partner.isLegendary ? "LEGENDARY PARTNER" : "DEPARTMENT PARTNER"}</span></div>
      <div className="panel-tabs" role="tablist" aria-label="キャラクター情報">{tabs.map((item) => <button key={item.id} id={`${id}-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`${id}-panel`} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="partner-tab-content">
        {tab === "stats" && <><div className="stats-grid">{partner.stats.map((stat, index) => { const Icon = icons[index]; return <div className="stat-card" key={stat.label}><span><Icon size={16}/>{stat.label}</span><strong>{stat.value}</strong><small>基本 {stat.base}{stat.growth > 0 ? ` + ${stat.growth}` : ""}</small><div className="stat-gauge"><span style={{ width: `${Math.min(100, stat.value / (index === 0 ? 255 : 60) * 100)}%` }}/></div></div>; })}</div><p className="stat-note">{partner.owned ? "現在の育成状態を反映しています。" : "仲間になる前の基本ステータスです。"}</p></>}
        {tab === "skills" && <div className="skill-list">{partner.skills.map((skill) => <div key={skill.id}><span>0{skill.slot}</span><strong>{skill.confirmed ? skill.name : `固有技 ${skill.slot}`}</strong><small>{skill.confirmed ? "登録済み" : "準備中"}</small></div>)}</div>}
        {tab === "about" && <div className="partner-about"><p>{partner.description}</p><div><ScanLine size={20}/><span>{partner.isLegendary ? "4学科のパートナーをすべて集めると解放されます。" : `${partner.department}の展示で出会えるパートナーです。`}</span></div><small>キャラクター獲得は準備中です。</small></div>}
      </div>
      {!detail && <Link href={`/collection/${partner.id}`} className="partner-detail-link">詳しく見る<ArrowUpRight size={17}/></Link>}
    </div>
  </section>;
}
