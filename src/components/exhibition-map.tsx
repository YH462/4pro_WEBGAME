import Link from "next/link";
import { Check, ArrowUpRight, LockKeyhole } from "lucide-react";
import { CharacterArt } from "./character-art";
import styles from "./exhibition-map.module.css";

type MapPartner = {
  id: string;
  name: string;
  element: string;
  department: { id: string; name: string } | null;
  owned: boolean;
};

// Position follows the department, even when character master data is reordered.
const areas = [
  { id: "mechanical", name: "機械科", position: styles.topLeft },
  { id: "electrical", name: "電気情報", position: styles.topRight },
  { id: "control", name: "電子制御", position: styles.bottomLeft },
  { id: "civil", name: "建設システム", position: styles.bottomRight },
];

export function ExhibitionMap({ partners, legend, hasPlayer }: {
  partners: MapPartner[];
  legend?: MapPartner;
  hasPlayer: boolean;
}) {
  return (
    <section className={styles.map} aria-label="4学科の展示マップ">
      {areas.map((area) => {
        const partner = partners.find((item) => item.department?.id === area.id);
        const name = partner?.department?.name ?? area.name;
        return (
          <Link
            key={area.id}
            href={hasPlayer ? (partner ? `/collection/${partner.id}` : "/collection") : "/start"}
            className={`${styles.area} ${area.position} ${partner?.owned ? "" : styles.locked} element-${(partner?.element ?? "LEGEND").toLowerCase()}`}
            aria-label={`${name}：${partner?.owned ? `${partner.name}（獲得済み）` : "未獲得"}`}
          >
            <div className={styles.content}>
              <div className={styles.art}><CharacterArt element={partner?.element ?? "LEGEND"} locked={!partner?.owned}/></div>
              <h2>{name}<ArrowUpRight size={16}/></h2>
              <span className={styles.characterName}>{partner?.owned ? partner.name : "未獲得"}</span>
              {partner?.owned && <span className={`${styles.status} ${styles.owned}`}><Check size={12}/>獲得済み</span>}
            </div>
          </Link>
        );
      })}

      <Link
        href={hasPlayer ? "/collection/four-pro" : "/start"}
        className={`${styles.hub} ${legend?.owned ? "" : styles.locked}`}
        aria-label={`4プロ：${legend?.owned ? "獲得済み" : "全学科コンプリートで解放"}`}
      >
        <CharacterArt element={legend?.element ?? "LEGEND"} locked={!legend?.owned}/>
        <h2>{legend?.name ?? "4プロ"}</h2>
        <span className={styles.hubStatus}>
          {legend?.owned ? <><Check size={12}/>獲得済み</> : <><LockKeyhole size={12}/>4学科を集めて解放</>}
        </span>
      </Link>

      <svg className={styles.dividers} viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <path d="M500 0V186M0 300H250M750 300H1000M500 414V600"/>
        <path className={styles.hubOutline} d="M250 300L400 186H600L750 300L600 414H400Z"/>
      </svg>
    </section>
  );
}
