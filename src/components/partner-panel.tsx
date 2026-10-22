"use client";

import { useId, useRef, useState } from "react";
import { BarChart3, Check, FileText, Gauge, Heart, LockKeyhole, ScanLine, Shield, Sparkles, Swords } from "lucide-react";
import { CharacterArt } from "./character-art";
import type { PartnerView } from "@/lib/character-presentation";
import styles from "./partner-panel.module.css";

const tabs = [
  { id: "stats", label: "ステータス", icon: BarChart3 },
  { id: "skills", label: "必殺技", icon: Sparkles },
  { id: "about", label: "紹介", icon: FileText },
] as const;
const statIcons = [Heart, Swords, Shield, Gauge];
const statColors = [styles.hp, styles.attack, styles.defense, styles.charge];

export function PartnerPanel({ partner }: { partner: PartnerView }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("stats");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  return (
    <section className={styles.panel} aria-label={partner.name}>
      <div className={styles.hero}>
        <div className={styles.portrait}>
          <span className={styles.number}>No. {String(partner.number).padStart(3, "0")}</span>
          <span className={`${styles.ownership} ${partner.owned ? styles.owned : ""}`}>
            {partner.owned ? <Check size={14}/> : <LockKeyhole size={14}/>}
            {partner.owned ? "獲得済み" : "未獲得"}
          </span>
          <div className={styles.frame}>
            <svg className={styles.frameLines} viewBox="0 0 240 216" aria-hidden="true">
              <polygon points="62,4 178,4 236,108 178,212 62,212 4,108" fill="#fff9" stroke="#fff" strokeWidth="7"/>
              <polygon points="62,4 178,4 236,108 178,212 62,212 4,108" fill="none" stroke="currentColor" strokeWidth="1" opacity=".4"/>
              <polygon points="66,11 174,11 228,108 174,205 66,205 12,108" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M44 54 66 11h73M206 148l-32 57H99M12 108l22 40" fill="none" stroke="currentColor" strokeWidth="3"/>
            </svg>
            <CharacterArt element={partner.element} imageUrl={partner.imageUrl} className={styles.art} locked={!partner.owned}/>
          </div>
        </div>
        <div className={styles.identity}>
          <span className={styles.department}>{partner.department}</span>
          <h1>{partner.name}</h1>
        </div>
      </div>

      <div className={styles.information}>
        <div className={styles.tabs} role="tablist" aria-label="キャラクター情報">
          {tabs.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`${id}-${item.id}`}
              type="button"
              role="tab"
              tabIndex={tab === item.id ? 0 : -1}
              aria-selected={tab === item.id}
              aria-controls={`${id}-panel`}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
                else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = tabs.length - 1;
                else return;
                event.preventDefault();
                setTab(tabs[next].id);
                tabRefs.current[next]?.focus();
              }}
            >
              <item.icon size={19}/><span>{item.label}</span>
            </button>
          ))}
        </div>

        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className={styles.content}>
          {tab === "stats" && <div className={styles.stats}>
            {partner.stats.map((stat, index) => {
              const Icon = statIcons[index];
              // These scales are visual guides, not growth limits or maximum HP.
              const filledSegments = stat.value === null || index === 3 ? 0 : Math.min(8, Math.max(0, Math.round(stat.value / (index === 0 ? 255 : 60) * 8)));
              const fillEnd = filledSegments / 8 * 100;
              // Match the divider's 6-unit bend in the 320-unit SVG viewBox.
              const chevronOffset = 6 / 320 * 100;
              return (
                <div className={`stat-card ${styles.stat} ${statColors[index]}`} key={stat.label} role="group" aria-label={stat.label}>
                  <Icon className={styles.statIcon} size={25}/>
                  <div className={styles.statValue}>
                    <span>{stat.label}</span>
                    <strong>{stat.value ?? "—"}</strong>
                    <small>{stat.value === null ? "設定待ち" : <>基本 {stat.base}{stat.growth > 0 ? ` + ${stat.growth}` : ""}</>}</small>
                  </div>
                  <div className={styles.gauge} aria-hidden="true">
                    <div className={styles.gaugeTrack}>
                      {filledSegments > 0 && <span className={styles.gaugeFill} style={{
                        clipPath: filledSegments === 8 ? undefined : `polygon(0 0,${fillEnd - chevronOffset}% 0,${fillEnd + chevronOffset}% 50%,${fillEnd - chevronOffset}% 100%,0 100%)`,
                      }}/>}
                      <svg className={styles.gaugeDividers} viewBox="0 0 320 40" preserveAspectRatio="none">
                        {Array.from({ length: 7 }, (_, segment) => (
                          <path key={segment} d={`M${(segment + 1) * 40 - 6} 0l12 20-12 20`} vectorEffect="non-scaling-stroke"/>
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>}
          {tab === "skills" && <div className={`skill-list ${styles.skills}`}>
            <div>
              <svg className={styles.skillBackdrop} viewBox="0 0 200 200" aria-hidden="true">
                <polygon points="138,14 158,14 168,32 158,50 138,50 128,32" opacity=".055"/>
                <polygon points="68,62 122,62 149,109 122,156 68,156 41,109" opacity=".025"/>
                <polygon points="116,135 156,135 176,170 156,205 116,205 96,170" opacity=".025"/>
              </svg>
              <span className={styles.skillEmblem}><Sparkles className={styles.skillIcon} size={24}/></span>
              <div className={styles.skillHeading}>
                <span className={styles.skillEyebrow}>SPECIAL SKILL</span>
                <strong>{partner.specialMove?.name ?? "必殺技"}</strong>
              </div>
              <small className={styles.skillBadge}>{partner.specialMove?.confirmed ? "登録済み" : "準備中"}</small>
              <p>必殺ゲージ（EP）を消費して使う、<br/>キャラごとの技です。</p>
              <span className={styles.skillNote}>効果・消費EPは準備中です。</span>
            </div>
          </div>}
          {tab === "about" && <div className={styles.about}>
            <p>{partner.description}</p>
            <div><ScanLine size={23}/><span>{partner.isDraft ? "仮配置のキャラクターです。CPU対戦でお試しできます。" : partner.isLegendary ? "4学科のパートナーをすべて集めると解放されます。" : partner.departmentId?`${partner.department}の展示で出会えるパートナーです。`:"展示のタグから獲得できるパートナーです。"}</span></div>
            <small>展示のタグ・QRから仲間にできます。</small>
          </div>}
        </div>
      </div>
    </section>
  );
}
