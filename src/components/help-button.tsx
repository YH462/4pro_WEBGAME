"use client";
import { useRef } from "react";
import { BookOpen, ChevronRight, CircleHelp, X } from "lucide-react";
import { GuideArt } from "./guide-art";
import styles from "./help-button.module.css";

const steps = [
  { art: "collect", title: "展示で仲間を集める", text: <>4学科のNFCタグ・QRから<br/>キャラクターを獲得。</> },
  { art: "grow", title: "ミニゲームで育てる", text: <>スコアやQRを読み取り、<br/>仲間をパワーアップ。</> },
  { art: "battle", title: "みんなでレイドに挑む", text: <>会場の受付QRから、<br/>最大20人で協力。</> },
] as const;

export function HelpButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button type="button" className="icon-button" aria-label="遊び方を開く" onClick={() => dialog.current?.showModal()}><CircleHelp size={21}/></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="help-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>HOW TO PLAY</span>
          <h2 id="help-title">冒険のガイド</h2>
          <p>4PROの冒険をはじめるための、<br/>3つのステップをご紹介します。</p>
          <button type="button" className={styles.close} aria-label="遊び方を閉じる" onClick={() => dialog.current?.close()}><X size={25}/></button>
        </header>
        <div className={styles.body}>
          <ol className={styles.steps}>{steps.map((step, index) => <li className={styles.step} key={step.art}>
            <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.art}><GuideArt kind={step.art}/></div>
            <div className={styles.description}><h3>{step.title}</h3><p>{step.text}</p></div>
            <ChevronRight className={styles.arrow} size={19} aria-hidden="true"/>
          </li>)}</ol>
          <div className={styles.notice}><BookOpen size={23} aria-hidden="true"/><p>図鑑・プロフィール・CPU対戦を利用できます。<br/>獲得・育成・レイドは準備中です。</p></div>
          <p className={styles.privacy}>※進行状況はCookieとサーバーで管理します。同じ端末・ブラウザで遊んでください。Cookieを削除すると引き継げません。イベント終了後に運営がデータを削除します。</p>
          <button type="button" className={styles.confirm} onClick={() => dialog.current?.close()}><span>ガイドを閉じる</span><ChevronRight size={25} aria-hidden="true"/></button>
        </div>
      </div>
    </dialog></>;
}
