import Link from "next/link";
import { Check, ArrowUpRight, Radio, ScanLine } from "lucide-react";
import { CharacterArt } from "./character-art";

type MapPartner = { id: string; name: string; element: string; department: { name: string } | null; owned: boolean };
export function ExhibitionMap({ partners, hasPlayer }: { partners: MapPartner[]; hasPlayer: boolean }) {
  return <section className="exhibition-map" aria-label="4学科の展示マップ">
    <div className="map-corner map-corner-tl"/><div className="map-corner map-corner-br"/>
    <div className="map-heading"><span><Radio size={14}/> EXHIBITION MAP</span><span>4つの展示をめぐろう</span></div>
    <svg className="map-paths" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><path className="map-path-shadow" d="M250 160H420L500 300 580 160H750M250 440H420L500 300 580 440H750"/><path className="map-path" d="M250 160H420L500 300 580 160H750M250 440H420L500 300 580 440H750"/><path className="map-route" d="M250 160V440H750V160Z"/></svg>
    <div className="map-hub"><div className="hub-hex"><span>4</span><strong>PRO</strong></div><span className="hub-caption">4つの力を、ひとつに。</span></div>
    {partners.map((partner, index) => <Link key={partner.id} href={hasPlayer ? `/collection/${partner.id}` : "/start"} className={`map-station station-${index + 1} element-${partner.element.toLowerCase()} ${partner.owned ? "station-owned" : ""}`} aria-label={`${partner.department?.name}：${partner.name}${partner.owned ? "（獲得済み）" : ""}`}><span className="station-number">0{index + 1}</span><div className="station-portrait"><CharacterArt element={partner.element}/></div><div className="station-label"><span>{partner.department?.name}<ArrowUpRight size={13}/></span><small>{partner.name}</small></div><span className="station-status">{partner.owned ? <><Check size={11}/>獲得済み</> : <><ScanLine size={11}/>展示で出会う</>}</span></Link>)}
    <div className="map-legend"><span className="signal-dot"/> タップしてパートナーを確認</div><span className="map-coordinates">4 DEPARTMENTS / 1 ADVENTURE</span>
  </section>;
}
