"use client";

import { useId, useRef, useState } from "react";
import { Award, BookOpen, Check, Copy, ShieldCheck, SquarePen, Trophy, UserRound } from "lucide-react";
import { GuestForm } from "./guest-form";
import styles from "./profile-panel.module.css";

const tabs = [
  { id: "profile", label: "プロフィール", icon: UserRound },
  { id: "records", label: "冒険の記録", icon: BookOpen },
] as const;

export function ProfilePanel({ id, nickname, count, total }: { id: string; nickname: string; count: number; total: number }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("profile");
  const [copyMessage, setCopyMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prefix = useId();

  return (
    <section className={styles.panel} aria-label="アカウント情報">
      <svg className={styles.decoration} viewBox="0 0 800 700" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="34,28 74,28 94,62 74,96 34,96 14,62" opacity=".08"/>
        <polygon points="624,78 690,78 723,135 690,192 624,192 591,135" opacity=".045"/>
        <polygon points="764,150 830,150 863,207 830,264 764,264 731,207" fill="none" stroke="currentColor" opacity=".12"/>
        <polygon points="15,615 55,615 75,650 55,685 15,685 -5,650" opacity=".06"/>
        <polygon points="724,630 780,630 808,678 780,726 724,726 696,678" opacity=".05"/>
      </svg>
      <div className={styles.identity}>
        <span className={styles.guest}><ShieldCheck size={15}/>GUEST</span>
        <div className={styles.avatar}>
          <svg viewBox="0 0 124 112" className={styles.avatarFrame} aria-hidden="true">
            <polygon points="32,3 92,3 122,56 92,109 32,109 2,56" fill="#fff8" stroke="#f3bac6"/>
            <polygon points="35,10 89,10 115,56 89,102 35,102 9,56" fill="#ffe7ecaa" stroke="#e82b46" strokeWidth="1.2"/>
            <path d="M20 36 35 10h35M104 76 89 102H62" stroke="#df2638" strokeWidth="2.5" fill="none"/>
          </svg>
          <svg viewBox="0 0 100 100" className={styles.avatarPerson} aria-hidden="true">
            <circle cx="50" cy="32" r="15"/>
            <path d="M23 83c0-23 11-37 27-37s27 14 27 37Z"/>
          </svg>
        </div>
        <div className={styles.name}>
          <span>EXHIBITION EXPLORER</span>
          <div><h2>{nickname || "ゲスト"}</h2><button type="button" aria-label="ニックネームを編集" onClick={() => {
            setTab("profile");
            requestAnimationFrame(() => input.current?.focus());
          }}><SquarePen size={20}/></button></div>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="プロフィールの表示">
        {tabs.map((item, index) => <button
          key={item.id}
          ref={(element) => { tabRefs.current[index] = element; }}
          id={`${prefix}-${item.id}`}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          tabIndex={tab === item.id ? 0 : -1}
          aria-controls={`${prefix}-content`}
          onClick={() => setTab(item.id)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
            setTab(tabs[next].id);
            tabRefs.current[next]?.focus();
          }}
        ><item.icon size={22}/><span>{item.label}</span></button>)}
      </div>

      <div id={`${prefix}-content`} className={styles.content} role="tabpanel" aria-labelledby={`${prefix}-${tab}`}>
        {tab === "profile" ? <div className={styles.details}>
          <GuestForm mode="edit" initialNickname={nickname} inputRef={input} className={styles.form}/>
          <div className={styles.playerInfo}>
            <div className={styles.playerId}>
              <span>PLAYER ID</span>
              <code>{id}</code>
              <button type="button" aria-label="プレイヤーIDをコピー" onClick={async () => {
                try { await navigator.clipboard.writeText(id); setCopyMessage("コピーしました。"); }
                catch { setCopyMessage("コピーできませんでした。IDを選択してコピーしてください。"); }
              }}>{copyMessage === "コピーしました。" ? <Check size={19}/> : <Copy size={19}/>}</button>
            </div>
            <p className={styles.copyMessage} aria-live="polite">{copyMessage}</p>
            <p className={styles.privacy}>Cookieを削除すると進行状況を引き継げません。</p>
          </div>
        </div> : <div className={styles.records}>
          <div className={styles.recordStats}>
            <div className={`${styles.recordCard} ${styles.partners}`}><BookOpen size={28}/><strong>{count}<small> / {total}</small></strong><span>パートナー</span></div>
            <div className={`${styles.recordCard} ${styles.trophies}`}><Trophy size={28}/><strong>—</strong><span>討伐記録</span></div>
            <div className={`${styles.recordCard} ${styles.badges}`}><Award size={28}/><strong>—</strong><span>称号・バッジ</span></div>
          </div>
          <p>討伐記録と称号・バッジは準備中です。<br/>まずは展示のパートナーに会いにいこう。</p>
        </div>}
      </div>
    </section>
  );
}
