"use client";

import { useId, useRef, useState } from "react";
import { Expand, ImageOff, Map, Minus, Plus, X } from "lucide-react";
import type { HintImageAsset } from "@/lib/character-location-hints";
import styles from "./character-location-hint.module.css";

export function CharacterHintMedia({ image, label, kind }: { image: HintImageAsset | null; label: string; kind: "overview" | "detail" | "map" }) {
  const dialog = useRef<HTMLDialogElement>(null), viewport = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const ready = Boolean(image && failedSrc !== image.src);
  const Icon = kind === "map" ? Map : ImageOff;
  const close = () => dialog.current?.close();
  return <figure className={styles.media} data-hint-media={kind}>
    <figcaption><strong>{label}</strong>{ready && <span><Expand size={13} aria-hidden="true"/>タップで拡大</span>}</figcaption>
    {ready && image ? <button type="button" className={styles.imageButton} aria-label={`${label}を拡大する`} onClick={() => {
      setZoom(1); dialog.current?.showModal(); viewport.current?.scrollTo(0, 0);
    }}><img src={image.src} alt={image.alt || label} onError={() => setFailedSrc(image.src)} loading="eager"/></button>
      : <div className={styles.placeholder} role="img" aria-label={`${label}：${image ? "画像を表示できません" : "準備中"}`}><Icon size={28} aria-hidden="true"/><span>{image ? "画像を表示できません" : `${kind === "map" ? "地図" : "写真"}は準備中です`}</span></div>}
    <dialog className={styles.viewer} ref={dialog} aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.viewerBody}>
        <header><strong id={titleId}>{label}</strong><div className={styles.viewerTools}>
          <button type="button" aria-label="画像を縮小する" disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value - .5))}><Minus size={20}/></button>
          <output aria-live="polite" aria-label="画像の表示倍率">{Math.round(zoom * 100)}%</output>
          <button type="button" aria-label="画像をさらに拡大する" disabled={zoom === 3} onClick={() => setZoom(value => Math.min(3, value + .5))}><Plus size={20}/></button>
          <button type="button" aria-label="画像を閉じる" autoFocus onClick={close}><X size={22}/></button>
        </div></header>
        <div className={styles.imageViewport} ref={viewport}>{image && <img src={image.src} alt={image.alt || label} style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }} onError={() => { setFailedSrc(image.src); close(); }}/>}</div>
        <p>＋で拡大できます。拡大後は画像を動かして確認してください。</p>
      </div>
    </dialog>
  </figure>;
}
