import type { CSSProperties } from "react";
import { raidTutorialStep } from "@/lib/raid-tutorial-timing";
import frames from "./raid-tutorial-frames.json";
import styles from "./raid-tutorial.module.css";

const steps = [
  { title: "まず「このレイドに参加」を押す", description: "「参加完了！」が出たら準備OK。QRを開いただけでは参加できません。" },
  { title: "「攻撃」か「回復」を選ぶ", description: "バトルが始まったら、攻撃はボスへ。回復は自分のHPを回復！" },
  { title: "グー・チョキ・パーをタップ", description: "手を押すと、そのまま送信！ 毎ターン10秒以内に選ぼう。" },
  { title: "「送信完了！」でスクリーンに注目", description: "みんなでボスとじゃんけん！ 次の受付でも、行動→手の順に選ぼう。" },
];

export function RaidTutorial({ seconds }: { seconds: number }) {
  // Follow the shared server countdown, including after a screen reload.
  const active = raidTutorialStep(seconds);
  const focus = frames[active].focus;
  return <section className={styles.tutorial} aria-label="バトル前のルール説明" data-tutorial-step={active + 1}>
    <header className={styles.heading}><h2>スマホのこの場所を押してね！</h2><strong role="timer" aria-label="バトル開始まで">あと{seconds}秒</strong></header>
    <div className={styles.body}>
      <figure className={styles.phone} aria-label="スマホの操作見本">
        {frames.map((frame, index) => <img key={frame.image} src={frame.image} width={732} height={1392} alt={active === index ? `スマホ画面の見本：${steps[index].title}` : ""} aria-hidden={active !== index} data-active={active === index} loading="eager" fetchPriority={index === 0 ? "high" : "auto"}/>)}
        <div className={styles.focus} aria-hidden="true" style={{ left: `${focus.x}%`, top: `${focus.y}%`, width: `${focus.width}%`, height: `${focus.height}%` } as CSSProperties}><b>{active + 1}</b></div>
        <figcaption>スマホ画面の見本</figcaption>
      </figure>
      <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title} aria-current={index === active ? "step" : undefined}><b>{index + 1}</b><div><strong>{step.title}</strong><p>{step.description}</p></div></li>)}</ol>
    </div>
    <footer className={styles.footer}><strong>勝ち ×2 ／ あいこ ×1 ／ 負け ×0.5</strong><span>攻撃・回復の両方に適用。未入力でも反撃を受けます。</span></footer>
  </section>;
}
