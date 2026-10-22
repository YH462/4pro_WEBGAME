"use client";

import { useId } from "react";
import styles from "./raid-mobile.module.css";

/** One continuous, clipped bar. Chevron seams sit over the fill, never between separate cells. */
export function RaidHpGauge({ value, max, label, caption = "HP" }: { value: number | null; max: number; label: string; caption?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, value / Math.max(1, max)));
  const low = value !== null && value > 0 && ratio <= .25;
  return <div className={styles.vitals} data-low={low} data-empty={value === 0}>
    <span className={styles.hpCaption}>{caption}</span>
    <div className={styles.hpGauge} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value ?? undefined} aria-valuetext={value === null ? "接続中" : undefined}>
      <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-clip`}><path d="M10 2H290L298 10L290 18H10L2 10Z"/></clipPath>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F65A70"/><stop offset=".5" stopColor="#E8223C"/><stop offset="1" stopColor="#A10F29"/></linearGradient>
        </defs>
        <path d="M10 1H290L299 10L290 19H10L1 10Z" fill="#E9E7EC" stroke="#CDC8D0" strokeWidth="1"/>
        <g clipPath={`url(#${id}-clip)`}>
          <rect className={styles.hpFill} width={300 * ratio} height="20" fill={`url(#${id}-fill)`}/>
          <path d={Array.from({ length: 11 }, (_, i) => `M${(i + 1) * 25 - 4} 1L${(i + 1) * 25 + 4} 10L${(i + 1) * 25 - 4} 19`).join("")} fill="none" stroke="#FFFFFF" strokeOpacity=".6" strokeWidth="1"/>
          <path d="M10 3H290" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="1"/>
        </g>
      </svg>
    </div>
    <strong className={styles.hpValue}>{value ?? "—"}<small> / {max}</small></strong>
  </div>;
}
