import Link from "next/link";
import { ArrowLeft, Lightbulb, LockKeyhole, MapPin } from "lucide-react";
import type { CharacterLocationHint as Hint } from "@/lib/character-location-hints";
import { CharacterHintMedia } from "./character-hint-media";
import styles from "./character-location-hint.module.css";

export function CharacterLocationHint({ name, number, hint, backHref = "/collection", backLabel = "図鑑に戻る" }: { name: string; number: number; hint: Hint; backHref?: string; backLabel?: string }) {
  return <div className={styles.screen}>
    <div className={styles.heading}><Link href={backHref}><ArrowLeft size={20} aria-hidden="true"/>{backLabel}</Link><span><Lightbulb size={16} aria-hidden="true"/>場所のヒント</span></div>
    <section className={`${styles.panel} ${hint.singlePhoto ? styles.singlePhoto : ""}`} aria-label={`${name}の場所のヒント`}>
      <header className={styles.identity}><div><span>No. {String(number).padStart(3, "0")}</span><h1>{name}</h1><p className={styles.location} aria-label="獲得場所"><MapPin size={16} aria-hidden="true"/><span>{hint.location || "場所は準備中です"}</span></p></div><span className={styles.locked}><LockKeyhole size={15} aria-hidden="true"/>未獲得</span></header>
      <div className={styles.photos} role="group" aria-label="場所のヒント写真">{hint.photos.map(photo => <CharacterHintMedia key={photo.kind} kind={photo.kind} label={photo.label} image={photo.image}/>)}</div>
      {!hint.singlePhoto && <div className={styles.map}><CharacterHintMedia kind="map" label="地図で場所を確認" image={hint.map}/></div>}
      <div className={styles.description}><Lightbulb size={20} aria-hidden="true"/><p>{hint.text}</p></div>
    </section>
  </div>;
}
