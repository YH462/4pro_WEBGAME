import Link from "next/link";
import { Check, LockKeyhole } from "lucide-react";
import { CharacterArt } from "./character-art";
import type { PartnerView } from "@/lib/character-presentation";
import styles from "./partner-collection.module.css";

const departmentStyles: Record<string, string> = {
  mechanical: styles.mechanical,
  electrical: styles.electrical,
  control: styles.control,
  civil: styles.civil,
};

export function PartnerCollection({ partners }: { partners: PartnerView[] }) {
  const emptySlots = Array.from({ length: Math.max(0, 12 - partners.length) });

  return (
    <ul className={styles.grid} aria-label="キャラクター一覧">
      {partners.map((partner) => (
        <li key={partner.id} className={styles.slot}>
          <Link
            href={`/collection/${partner.id}`}
            className={`collection-card ${styles.hexagon} ${departmentStyles[partner.departmentId ?? ""] ?? ""} ${partner.isLegendary ? styles.legendary : ""} ${partner.owned ? styles.owned : styles.locked}`}
            aria-label={`${partner.name}の詳細を見る${partner.owned ? "（獲得済み）" : "（未獲得）"}`}
          >
            <span className={styles.innerFill} aria-hidden="true"/>
            <div className={styles.content}>
              <span className={styles.number}>{String(partner.number).padStart(3, "0")}</span>
              <CharacterArt element={partner.element} imageUrl={partner.imageUrl} locked={!partner.owned} className={styles.art}/>
              <strong>{partner.department}</strong>
              <span className={styles.name}>{partner.owned ? partner.name : "未獲得"}</span>
              <span className={styles.status}>
                {partner.owned ? <><Check size={12}/>獲得済み</> : <LockKeyhole size={12}/>}
              </span>
            </div>
          </Link>
        </li>
      ))}
      {emptySlots.map((_, index) => (
        <li key={`empty-${index}`} className={styles.slot}>
          <div className={`${styles.hexagon} ${styles.placeholder}`} aria-label={`キャラクター枠${partners.length + index + 1}：準備中`}>
            <span className={styles.innerFill} aria-hidden="true"/>
            <div className={styles.content}>
              <span className={styles.number}>{String(partners.length + index + 1).padStart(3, "0")}</span>
              <LockKeyhole className={styles.placeholderIcon} aria-hidden="true"/>
              <span className={styles.placeholderLabel}>準備中</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
