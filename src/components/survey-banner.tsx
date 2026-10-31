import { ClipboardList, ExternalLink } from "lucide-react";
import { surveyHref } from "@/lib/survey";
import styles from "./survey-banner.module.css";

export function SurveyBanner({ url }: { url?: string }) {
  const href = surveyHref(url);
  const content = <><ClipboardList aria-hidden="true"/><span><strong>高専祭アンケート</strong><small>{href ? "タップしてアンケートに回答" : "ただいま準備中です"}</small></span>{href ? <ExternalLink aria-hidden="true"/> : <span className={styles.badge}>準備中</span>}</>;
  return href
    ? <a className={styles.banner} href={href} target="_blank" rel="noopener noreferrer" aria-label="高専祭アンケート（外部サイトを新しいタブで開く）">{content}</a>
    : <section className={styles.banner} aria-label="高専祭アンケート">{content}</section>;
}
