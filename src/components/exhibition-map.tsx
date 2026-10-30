import Link from "next/link";
import { Check, ChevronRight, LockKeyhole } from "lucide-react";
import { characterImageUrl } from "@/lib/character-edit-input";
import { CharacterArt } from "./character-art";
import styles from "./exhibition-map.module.css";

type MapPartner = {
  id: string;
  name: string;
  element: string;
  imageId?:string|null;
  department: { id: string; name: string } | null;
  owned: boolean;
};

// Position follows the department, even when character master data is reordered.
const areas = [
  { id: "mechanical", name: "機械科", number: "01", position: styles.topLeft },
  { id: "electrical", name: "電気情報", number: "02", position: styles.topRight },
  { id: "control", name: "電子制御", number: "03", position: styles.bottomLeft },
  { id: "civil", name: "建設システム", number: "04", position: styles.bottomRight },
];

export function ExhibitionMap({ partners, legend, collectionHref = "/collection" }: {
  partners: MapPartner[];
  legend?: MapPartner;
  collectionHref?: string;
}) {
  return (
    <section className={styles.map} aria-label="4学科の展示マップ">
      {areas.map((area) => {
        const partner = partners.find((item) => item.department?.id === area.id);
        const name = partner?.department?.name ?? area.name;
        return (
          <Link
            key={area.id}
            href={partner ? `${collectionHref}/${partner.id}` : collectionHref}
            className={`${styles.area} ${area.position} ${partner?.owned ? "" : styles.locked}`}
            aria-label={`${name}：${partner?.owned ? `${partner.name}（獲得済み）` : "未獲得"}`}
          >
            <span className={styles.marker} aria-hidden="true"><b>{area.number}</b></span>
            <div className={styles.decoration} aria-hidden="true"><i/><i/><i/><i/></div>
            <div className={styles.content}>
              <div className={styles.art}><CharacterArt element={partner?.element ?? "LEGEND"} imageUrl={characterImageUrl(partner?.imageId)} locked={!partner?.owned}/></div>
              <h2>{name}<ChevronRight size={16} aria-hidden="true"/></h2>

              <span className={styles.status}>{partner?.owned ? <><Check size={12} aria-hidden="true"/>獲得済み</> : <><LockKeyhole size={11} aria-hidden="true"/>未獲得</>}</span>
            </div>
          </Link>
        );
      })}

      <Link
        href={`${collectionHref}/four-pro`}
        className={`${styles.hub} ${legend?.owned ? "" : styles.locked}`}
        aria-label={`4学科合同：${legend?.owned ? "獲得済み" : "全学科コンプリートで解放"}`}
      >
        <svg className={styles.hubFrame} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className={styles.hubOutline} d="M25.5 1H74.5L99 50 74.5 99H25.5L1 50Z"/>
          <path className={styles.hubInset} d="M27 4H73L96 50 73 96H27L4 50Z"/>
          <path className={styles.hubTrack} d="M29 7H71L93 50 71 93H29L7 50Z"/>
          <g className={styles.hubFacets} stroke="none">
            <path fill="#c63448" d="M29 7H47L18 34Z"/>
            <path fill="#216bad" d="M53 7H71L82 34Z"/>
            <path fill="#e5b747" d="M18 66L47 93H29Z"/>
            <path fill="#347953" d="M82 66L71 93H53Z"/>
          </g>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path className={styles.hubMechanical} d="M47 7H29L7 47"/>
            <path className={styles.hubElectrical} d="M53 7H71L93 47"/>
            <path className={styles.hubControl} d="M7 53L29 93H47"/>
            <path className={styles.hubCivil} d="M93 53L71 93H53"/>
          </g>
        </svg>
        <div className={styles.legendArt}><CharacterArt element={legend?.element ?? "LEGEND"} imageUrl={characterImageUrl(legend?.imageId)} locked={!legend?.owned}/></div>
        <h2>4学科合同<ChevronRight size={16} aria-hidden="true"/></h2>
        <span className={styles.hubStatus}>
          {legend?.owned ? <><Check size={12}/>獲得済み</> : <><LockKeyhole size={12}/>4学科を集めて解放</>}
        </span>
      </Link>

    </section>
  );
}
