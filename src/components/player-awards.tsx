import { BookOpen, Check, Compass, LockKeyhole, Medal, Swords, Trophy } from "lucide-react";
import type { PlayerAwardsView } from "@/lib/achievement-rules";
import styles from "./player-awards.module.css";

const icons={collection:BookOpen,departments:Compass,raid:Swords,victory:Trophy};
export function PlayerAwards({awards}:{awards:PlayerAwardsView}){
  const badges=[...awards.achievements].sort((a,b)=>Number(Boolean(b.earnedAt))-Number(Boolean(a.earnedAt)));
  return <section className={styles.panel} aria-label="報酬と称号・バッジ">
    <div className={styles.points} role="group" aria-label="討伐ポイント"><Medal aria-hidden="true"/><span>討伐ポイント</span><strong>{awards.points.toLocaleString("ja-JP")}<small>pt</small></strong></div>
    <h3>称号・バッジ</h3>
    <ul className={styles.badges} aria-label="称号・バッジの獲得状況">
      {badges.map(item=>{
        const Icon=icons[item.icon],earned=Boolean(item.earnedAt);
        return <li key={item.code} data-earned={earned} aria-label={`${item.badge}（${earned?"獲得済み":"未獲得"}）`}>
          <span className={styles.emblem}><Icon aria-hidden="true"/></span>
          <div><strong>{item.badge}</strong><p>称号：{item.title}</p><span>{item.condition}</span></div>
          <b className={styles.progress}>{earned?<><Check size={18} aria-hidden="true"/>獲得済み</>:<><LockKeyhole size={16} aria-hidden="true"/>{item.progress} / {item.target}</>}</b>
        </li>;
      })}
    </ul>
    {awards.rewards.length>0&&<details className={styles.history}>
      <summary>討伐ポイントの履歴</summary>
      <ul>{awards.rewards.map(item=><li key={item.id}><div><strong>{item.bossName}討伐</strong><time dateTime={item.awardedAt}>{new Date(item.awardedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</time></div><b>+{item.points} pt</b></li>)}</ul>
    </details>}
  </section>;
}
