"use client";
import { useRef } from "react";
import { CircleHelp, X, ScanLine, Sparkles, Swords } from "lucide-react";

export function HelpButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button type="button" className="icon-button" aria-label="遊び方を開く" onClick={() => dialog.current?.showModal()}><CircleHelp size={21}/></button>
    <dialog ref={dialog} className="help-dialog" aria-labelledby="help-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-heading"><div><span className="eyebrow">HOW TO PLAY</span><h2 id="help-title">冒険のガイド</h2></div><button type="button" className="icon-button" aria-label="遊び方を閉じる" onClick={() => dialog.current?.close()}><X size={22}/></button></div>
      <div className="guide-steps">{[{ icon: ScanLine, title: "展示で仲間を集める", text: "4学科のNFCタグ・QRからキャラを獲得。", n: "01" }, { icon: Sparkles, title: "ミニゲームで育てる", text: "スコアQRを読み取り、仲間をパワーアップ。", n: "02" }, { icon: Swords, title: "みんなでレイドに挑む", text: "会場の受付QRから、最大20人で協力。", n: "03" }].map(({ icon: Icon, title, text, n }) => <div key={n}><span className="guide-number">{n}</span><Icon size={23}/><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
      <p className="guide-note">現在は図鑑とプロフィールを利用できます。キャラ獲得・育成・レイドは準備中です。</p>
      <p className="cookie-note">進行状況はCookieとサーバーで管理します。同じ端末・ブラウザで遊んでください。Cookieを削除すると引き継げません。イベント終了後に運営がデータを削除します。</p>
      <button type="button" className="button primary" onClick={() => dialog.current?.close()}>ガイドを閉じる</button>
    </dialog></>;
}
