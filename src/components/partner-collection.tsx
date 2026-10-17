"use client";
import { useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { PartnerPanel } from "./partner-panel";
import { CharacterArt } from "./character-art";
import type { PartnerView } from "@/lib/character-presentation";

export function PartnerCollection({ partners }: { partners: PartnerView[] }) {
  const [selected, setSelected] = useState(0);
  const partner = partners[selected];
  if (!partner) return <div className="empty-panel">パートナーの情報を準備しています。</div>;
  return <div className="collection-browser"><PartnerPanel key={partner.id} partner={partner}/><div className="catalog-selector" role="group" aria-label="パートナーを選択">{partners.map((item, index) => <button type="button" key={item.id} className={`collection-card element-${item.element.toLowerCase()} ${index === selected ? "selected" : ""}`} onClick={() => setSelected(index)} aria-pressed={index === selected} aria-label={`${item.name}を選択`}><span className="selector-number">0{item.number}</span><CharacterArt element={item.element} locked={!item.owned}/><span className="selector-label">{item.department}</span><span className="selector-status">{item.owned ? <Check size={12}/> : <LockKeyhole size={11}/>}</span></button>)}</div></div>;
}
