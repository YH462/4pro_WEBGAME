"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, BookOpen, Check, Copy, Medal, SquarePen, Swords, Trophy, UserRound } from "lucide-react";
import { GuestForm } from "./guest-form";
import { CharacterArt } from "./character-art";
import type { AdventureRecords } from "@/lib/adventure-records";
import styles from "./profile-panel.module.css";
import { PlayerAwards } from "./player-awards";

const tabs = [
  { id: "profile", label: "プロフィール", icon: UserRound },
  { id: "records", label: "冒険の記録", icon: BookOpen },
  { id: "awards", label: "報酬・称号", icon: Medal },
] as const;

export function ProfilePanel({ id, nickname, initialRecords }: { id: string; nickname: string; initialRecords: AdventureRecords }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("profile");
  const [records, setRecords] = useState(initialRecords);
  const [recordsError, setRecordsError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prefix = useId();
  useEffect(() => { setRecords(initialRecords); }, [initialRecords]);
  useEffect(() => {
    if (tab === "profile") return;
    let active = true;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (document.hidden) return;
      controller?.abort();
      const request = new AbortController(); controller = request;
      try {
        const response = await fetch("/api/profile/records", { cache: "no-store", signal: request.signal });
        if (!active || request.signal.aborted) return;
        if (response.status === 401) { router.replace("/start"); return; }
        if (!response.ok) throw new Error("記録を更新できません。通信を確認してください。");
        const { records: next }: { records: AdventureRecords } = await response.json();
        if (!active || request.signal.aborted) return;
        if (next.playerId !== id) { router.refresh(); return; }
        setRecords(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
        setRecordsError("");
      } catch {
        if (active && !request.signal.aborted) setRecordsError("記録を更新できません。通信を確認してください。");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [tab, id, router]);

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

          <div><h2>{nickname || "ゲスト"}</h2><button type="button" aria-label="ニックネームを編集" onClick={() => {
            setTab("profile");
            requestAnimationFrame(() => input.current?.focus());
          }}><SquarePen size={20}/></button></div>
          {records.awards.activeTitle&&<p className={styles.earnedTitle} aria-label="獲得した称号"><Award size={16} aria-hidden="true"/>{records.awards.activeTitle}</p>}
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
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1 : event.key === "ArrowRight" ? (index+1)%tabs.length : (index+tabs.length-1)%tabs.length;
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
              <span>プレイヤーID</span>
              <code>{id}</code>
              <button type="button" aria-label="プレイヤーIDをコピー" onClick={async () => {
                try { await navigator.clipboard.writeText(id); setCopyMessage("コピーしました。"); }
                catch { setCopyMessage("コピーできませんでした。IDを選択してコピーしてください。"); }
              }}>{copyMessage === "コピーしました。" ? <Check size={19}/> : <Copy size={19}/>}</button>
            </div>
            <p className={styles.copyMessage} aria-live="polite">{copyMessage}</p>

          </div>
        </div> : tab==="awards" ? <div className={styles.awardsPanel}>{recordsError&&<p role="alert" className={styles.recordError}>{recordsError}</p>}<PlayerAwards awards={records.awards}/></div> : <div className={`${styles.records} ${styles.adventureRecords}`}>
          <div className={styles.recordStats}>
            <div className={`${styles.recordCard} ${styles.partners}`} role="group" aria-label="パートナー収集数"><BookOpen size={24}/><strong>{records.collected}<small> / {records.total}</small></strong><span>パートナー</span></div>
            <div className={`${styles.recordCard} ${styles.trophies}`} role="group" aria-label="討伐成功数"><Trophy size={24}/><strong>{records.victories}</strong><span>討伐成功</span></div>
            <div className={`${styles.recordCard} ${styles.badges}`} role="group" aria-label="レイド記録数"><Swords size={24}/><strong>{records.raidCount}</strong><span>レイド記録</span></div>
          </div>
          <div className={styles.recordDetails}>
            {recordsError && <p role="alert" className={styles.recordError}>{recordsError}</p>}
            <section aria-label="収集したパートナー">
              <h3>収集したパートナー</h3>
              {records.characters.length ? <ul className={styles.collectedPartners}>
                {records.characters.map(character => <li key={character.id}><Link href={`/collection/${character.id}`} aria-label={`${character.name}の収集記録`}>
                  <CharacterArt element={character.element} imageUrl={character.imageUrl}/><span>{character.name}</span>
                </Link></li>)}
              </ul> : <p className={styles.emptyRecord}>まだパートナーを集めていません</p>}
            </section>
            <section aria-label="最近のレイド">
              <h3>最近のレイド</h3>
              {records.raids.length ? <ul className={styles.raidHistory}>
                {records.raids.map(raid => <li key={raid.id}>
                  <div><strong>{raid.bossName}</strong><span className={raid.won ? styles.raidWon : styles.raidLost}>{raid.won ? "討伐成功" : "全滅"}</span></div>
                  <p>{raid.characterName} · {raid.turns}ラウンド</p>
                  <time dateTime={raid.finishedAt}>{new Date(raid.finishedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                </li>)}
              </ul> : <p className={styles.emptyRecord}>まだレイドの記録はありません</p>}
            </section>
          </div>
        </div>}
      </div>
    </section>
  );
}
