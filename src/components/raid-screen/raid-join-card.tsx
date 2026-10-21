"use client";

import { useRef, useState } from "react";
import { Expand, QrCode, Smartphone, X } from "lucide-react";
import type { RaidEntryTarget } from "@/lib/raid-entry";
import styles from "./raid-join-card.module.css";

export function RaidJoinCard({ targets, local, compact = false }: { targets: RaidEntryTarget[]; local: boolean; compact?: boolean }) {
  const [selected, setSelected] = useState("");
  const target = targets.find((item) => item.url === selected) ?? targets[0];
  const enlarged = useRef<HTMLDialogElement>(null);
  return <section className={`${styles.card} ${compact ? styles.compact : ""}`} aria-label="レイド参加案内">
    <div className={styles.eyebrow}><QrCode /><span>JOIN THE RAID</span><span>{local ? "LOCAL" : "PREVIEW"}</span></div>
    <h2>スマホで参加しよう！</h2>
    {target ? <>
      <button type="button" className={styles.qrButton} aria-label="参加QRを大きく表示" onClick={() => enlarged.current?.showModal()}>
        <img className={styles.qr} src={target.qrImage} alt="レイド参加用QRコード" width={492} height={492}/>
        <span><Expand />タップで拡大</span>
      </button>
      <p className={styles.instructions}><Smartphone /><span>スマホの<strong>標準カメラ</strong>で<br />読み取って参加</span></p>
      <a className={styles.url} href={target.url} target="_blank" rel="noreferrer" aria-label={`参加URL ${target.url}`}>{target.url}</a>
      <p className={styles.note}>{local ? "PCと同じWi-Fiに接続してください" : "バトルの操作プレビューへ進みます"}</p>
      <dialog className={styles.dialog} ref={enlarged} aria-labelledby="raid-entry-title" onClick={(event) => { if (event.target === event.currentTarget) enlarged.current?.close(); }}>
        <div className={styles.dialogHeading}><div><span>JOIN THE RAID</span><h2 id="raid-entry-title">スマホでレイドに参加</h2></div><button type="button" aria-label="参加QRの拡大を閉じる" onClick={() => enlarged.current?.close()}><X /></button></div>
        <img src={target.qrImage} alt="拡大したレイド参加用QRコード" width={492} height={492}/>
        <p>スマホの標準カメラで読み取ってください。</p>
        <a href={target.url} target="_blank" rel="noreferrer">{target.url}</a>
        {targets.length > 1 && <label className={styles.network}>接続先を選択<select value={target.url} onChange={(event) => setSelected(event.target.value)}>{targets.map((item) => <option key={item.url} value={item.url}>{new URL(item.url).host}</option>)}</select></label>}
        <p className={styles.dialogNote}>{local ? "スマホとPCを同じWi-Fiに接続してください。初めての方はニックネーム入力後、そのままレイドへ進みます。" : "操作プレビューです。正式なイベントの参加受付はまだ行っていません。"}</p>
      </dialog>
    </> : <div className={styles.unavailable}><Smartphone /><strong>接続先を確認してください</strong><p>PCをWi-Fiに接続し、<br />スクリーンを再読み込みすると<br />参加QRが表示されます。</p></div>}
  </section>;
}
