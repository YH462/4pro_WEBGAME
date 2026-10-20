"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Heart, Pause, Play, RotateCcw, Sparkles, Swords, Trophy, Users, Waves } from "lucide-react";
import type { RaidEntryTarget } from "@/lib/raid-entry";
import type { createShowcaseArena } from "@/lib/raid-showcase-arena";
import { showcaseScenes, showcaseImpactMs, type ShowcaseCue } from "@/lib/raid-showcase-scenes";
import { EnemyArt } from "../battle/enemy-art";
import { RaidJoinCard } from "./raid-join-card";
import styles from "./raid-showcase.module.css";

const icons = { idle: Users, attack: Swords, critical: Sparkles, heal: Heart, counter: Waves, weaken: Waves, victory: Trophy };

export function RaidShowcase({ entryTargets }: { entryTargets: RaidEntryTarget[] }) {
  const [cue, setCue] = useState<ShowcaseCue>("idle");
  const [iteration, setIteration] = useState(0);
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [impacted, setImpacted] = useState(false);
  const [renderer, setRenderer] = useState<"loading" | "webgl" | "fallback">("loading");
  const [fullscreenError, setFullscreenError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<ReturnType<typeof createShowcaseArena> | null>(null);
  const latest = useRef({ cue, paused }); latest.current = { cue, paused };
  const remaining = useRef(0);
  const impactRemaining = useRef(showcaseImpactMs);
  const scene = showcaseScenes.find((item) => item.id === cue)!;
  const attacking = cue === "attack" || cue === "critical";
  const hp = impacted || !attacking ? scene.hp : scene.beforeHp;

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const target = canvas.current!;
    const lost = (event: Event) => {
      event.preventDefault(); observer?.disconnect(); arena.current?.dispose(); arena.current = null; setRenderer("fallback");
    };
    const visibility = () => arena.current?.pause(latest.current.paused || document.hidden);
    target.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    void import("@/lib/raid-showcase-arena").then(({ createShowcaseArena }) => {
      if (cancelled) return;
      try {
        arena.current = createShowcaseArena(target);
        const rect = target.getBoundingClientRect(); arena.current.resize(rect.width, rect.height);
        arena.current.play(latest.current.cue); arena.current.pause(latest.current.paused || document.hidden);
        observer = new ResizeObserver(([entry]) => arena.current?.resize(entry.contentRect.width, entry.contentRect.height));
        observer.observe(target); setRenderer("webgl");
      } catch { arena.current?.dispose(); arena.current = null; setRenderer("fallback"); }
    }).catch(() => { if (!cancelled) setRenderer("fallback"); });
    return () => { cancelled = true; observer?.disconnect(); target.removeEventListener("webglcontextlost", lost); document.removeEventListener("visibilitychange", visibility); arena.current?.dispose(); arena.current = null; };
  }, []);

  useEffect(() => {
    arena.current?.play(cue);
    setImpacted(false); remaining.current = scene.seconds * 1000; impactRemaining.current = showcaseImpactMs;
  }, [cue, iteration, scene.seconds]);

  useEffect(() => { arena.current?.pause(paused || document.hidden); }, [paused]);

  useEffect(() => {
    if (paused || renderer === "loading") return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(); const delta = now - previous; previous = now;
      if (document.hidden) return;
      impactRemaining.current -= delta;
      if (impactRemaining.current <= 0) setImpacted(true);
      if (!auto) return;
      remaining.current -= delta;
      if (remaining.current <= 0) {
        const index = showcaseScenes.findIndex((item) => item.id === cue);
        setCue(showcaseScenes[(index + 1) % showcaseScenes.length].id);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [auto, paused, cue, iteration, renderer]);

  function select(next: ShowcaseCue) { setAuto(false); setPaused(false); setCue(next); setIteration((value) => value + 1); }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();
      setFullscreenError("");
    } catch { setFullscreenError("全画面にできませんでした。ブラウザの全画面表示をお試しください。"); }
  }

  return <div className={styles.viewport}>
    <main className={`${styles.screen} ${styles[cue]}`} data-cue={cue} data-paused={paused} aria-label="PC用レイド演出デモ">
      <div className={styles.honeycomb}/>
      <div className={styles.brand}>4<span>PRO</span><small>ONE TEAM. ONE RAID.</small></div>
      <div className={styles.demoBadge}>PC 演出デモ</div>
      <header className={styles.hud}>
        <div className={styles.bossTitle}><span>RAID BOSS / 01</span><h1>キング・アクア</h1><strong>{Math.round(hp / 450 * 100)}<small>%</small></strong></div>
        <div className={styles.health} role="progressbar" aria-label="演出デモのボスHP" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={450}>
          <span className={styles.delayedHealth} style={{ width: `${hp / 450 * 100}%` }}/><span className={styles.currentHealth} style={{ width: `${hp / 450 * 100}%` }}/>
        </div>
      </header>
      <section className={styles.arena} aria-label="ボスとエフェクト" data-renderer={renderer}>
        <div className={styles.floor}/>
        {renderer !== "webgl" && <div className={styles.fallback}><EnemyArt/></div>}
        <canvas ref={canvas} aria-label="キング・アクアと攻撃エフェクト" role="img"/>
        <div key={`${cue}:${iteration}`} className={styles.effects} aria-hidden="true" style={{ animationPlayState: paused ? "paused" : "running" }}>
          {(attacking || cue === "heal" || cue === "victory") && <div className={styles.sparkleCloud}>{Array.from({ length: cue === "critical" ? 36 : 18 }, (_, i) => {
            const size = .3 + i % 5 * .09;
            return <i key={i} style={{ left: `${54 + Math.sin(i * 12.7) * 28}%`, top: `${46 + Math.cos(i * 7.3) * 30}%`, width: `${size}cqw`, height: `${size}cqw`, animationDelay: `${(attacking ? .65 : .1) + i % 8 * .055}s` }}/>;
          })}</div>}
          {attacking && <><i className={styles.impactRing}/><i className={styles.impactRay}/><div className={styles.damage}><span>{cue === "critical" ? "×2" : "×1"}</span><strong>{cue === "critical" ? "100" : "50"}</strong></div></>}
          {cue === "heal" && <div className={styles.healSymbols}><span>+</span><span>+</span><strong>+60</strong><span>+</span></div>}
          {cue === "counter" && <div className={styles.waterWash}/>}
          {cue === "weaken" && <div className={styles.dangerPulse}/>}
          {cue === "victory" && <div className={styles.clear}><Trophy/><span>RAID COMPLETE</span><strong>討伐成功</strong></div>}
        </div>
        {renderer === "loading" && <p className={styles.rendererNote} role="status">3D演出を準備しています…</p>}
        {renderer === "fallback" && <p className={styles.rendererNote} role="status">簡易表示 · 3D表示にはWebGL対応ブラウザを使用してください</p>}
      </section>
      <div className={styles.members}><Users/><strong>12<small>人</small></strong><span>DEMO TEAM</span></div>
      <div className={styles.qr}><RaidJoinCard targets={entryTargets} local={false} compact/></div>
      <div className={styles.controls} aria-label="演出デモの操作">
        <div className={styles.playback}>
          <button type="button" disabled={renderer === "loading"} className={auto ? styles.active : ""} aria-pressed={auto} onClick={() => { setAuto((value) => !value); setPaused(false); if (cue === "victory") { setCue("idle"); setIteration((value) => value + 1); } }}><Play/>連続デモ</button>
          <button type="button" aria-label={paused ? "演出を再開" : "演出を一時停止"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play/> : <Pause/>}</button>
          <button type="button" aria-label="今の演出をもう一度" onClick={() => { setPaused(false); setIteration((value) => value + 1); }}><RotateCcw/></button>
        </div>
        <div className={styles.scenes} role="group" aria-label="演出を選ぶ">{showcaseScenes.map((item) => {
          const Icon = icons[item.id];
          return <button type="button" key={item.id} disabled={renderer === "loading"} aria-pressed={cue === item.id} onClick={() => select(item.id)}><Icon/><span>{item.label}</span></button>;
        })}</div>
      </div>
      <footer className={styles.tools}><a href="/raid/screen?sync=local">同期スクリーンへ戻る</a><button type="button" aria-label="全画面で表示" onClick={fullscreen}><Expand/></button></footer>
      <p className={styles.caption} role="status">{scene.label} <span>／ 人数・HPはデモ用の表示です</span></p>
      {fullscreenError && <p className={styles.error} role="alert">{fullscreenError}</p>}
    </main>
  </div>;
}
