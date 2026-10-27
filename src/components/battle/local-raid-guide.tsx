"use client";

import type { RefObject } from "react";
import { ArrowRight, Hand, HandFist, Scissors, X } from "lucide-react";
import { raidRpsRules } from "@/lib/raid-rps";
import styles from "./local-raid-guide.module.css";

const outcomes = [
  { id: "win", Icon: HandFist, className: styles.win },
  { id: "draw", Icon: Scissors, className: styles.draw },
  { id: "lose", Icon: Hand, className: styles.lose },
] as const;

export function LocalRaidGuide({ dialogRef, screenHref = "/raid/screen?sync=local" }: { dialogRef: RefObject<HTMLDialogElement | null>; screenHref?: string }) {
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="raid-mobile-rules" onClick={(event) => {
    if (event.target === event.currentTarget) dialogRef.current?.close();
  }}>
    <div className={styles.panel}>
      <header className={styles.header}>

        <h2 id="raid-mobile-rules"><span>レイド</span>の遊び方</h2>
        <p>攻撃はボスへ。回復は自分へ。<br/>行動を選び、手をタップすると送信します。</p>
        <button type="button" className={styles.close} aria-label="レイドのルールを閉じる" onClick={() => dialogRef.current?.close()}><X size={23}/></button>
        <div className={styles.decoration} aria-hidden="true"><i/><i/><i/></div>
      </header>
      <div className={styles.body}>
        <section className={styles.matchups} aria-labelledby="raid-guide-matchups">
          <h3 id="raid-guide-matchups">じゃんけんの相性</h3>
          <ul className={styles.outcomes} aria-label="じゃんけんの勝敗と倍率">{outcomes.map(({ id, Icon, className }) => <li className={`${styles.outcome} ${className}`} key={id}>
            <span className={styles.hand}><Icon size={25} aria-hidden="true"/></span>
            <div><span>{raidRpsRules[id].label}</span><strong>×{raidRpsRules[id].multiplier}</strong></div>
          </li>)}</ul>
        </section>
        <section className={styles.rules} aria-labelledby="raid-guide-rule-title">
          <h3 id="raid-guide-rule-title">ルール</h3>
          <ol>
            <li><span aria-hidden="true">1</span><p>受付は全員共通で<strong>10秒</strong>・1人1回。</p></li>
            <li><span aria-hidden="true">2</span><p>締め切り後は同じボスの手で勝敗を判定します。</p></li>
          </ol>

        </section>
        <a className={styles.screenLink} href={screenHref} target="_blank" rel="noreferrer">スクリーンを開く <ArrowRight size={23} aria-hidden="true"/></a>
      </div>
    </div>
  </dialog>;
}
