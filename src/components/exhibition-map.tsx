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
        <div className={styles.legendArt}><CharacterArt element={legend?.element ?? "LEGEND"} imageUrl={characterImageUrl(legend?.imageId)} locked={!legend?.owned}/></div>
        <h2>4学科合同<ChevronRight size={16} aria-hidden="true"/></h2>
        <span className={styles.hubStatus}>
          {legend?.owned ? <><Check size={12}/>獲得済み</> : <><LockKeyhole size={12}/>4学科を集めて解放</>}
        </span>
      </Link>

    </section>
  );
}
