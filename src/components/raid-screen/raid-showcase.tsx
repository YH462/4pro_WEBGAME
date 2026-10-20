"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Expand, Hand, HandFist, Heart, Pause, Play, RotateCcw, Scissors, Sparkles, Swords, Trophy, Users, Waves } from "lucide-react";
import type { RaidEntryTarget } from "@/lib/raid-entry";
import type { createShowcaseArena } from "@/lib/raid-showcase-arena";
import { showcaseScenes, showcaseImpactMs, type ShowcaseCue } from "@/lib/raid-showcase-scenes";
import { counterImpactMs, createShowcasePlayback, rpsRevealMs, showcaseRpsFrame, type ShowcaseFrame } from "@/lib/raid-showcase-playback";
import { raidHands, type RaidHand } from "@/lib/raid-rps";
import type { LocalRaidParticipant } from "@/lib/local-raid-types";
import { characterColors, type RaidArenaContext, type RaidScreenScene } from "@/lib/raid-screen-playback";
import { EnemyArt } from "../battle/enemy-art";
import { RaidJoinCard } from "./raid-join-card";
import styles from "./raid-showcase.module.css";

const icons = { idle: Users, rps: HandFist, attack: Swords, critical: Sparkles, heal: Heart, counter: Waves, weaken: Waves, victory: Trophy };
const handIcons = { rock: HandFist, scissors: Scissors, paper: Hand };
type RpsView = Pick<ReturnType<typeof showcaseRpsFrame>, "hand" | "revealed" | "beat">;

export type RaidScreenPresentation = {
  scene: RaidScreenScene; members: LocalRaidParticipant[]; bossName: string;
  local: boolean; status: string; title: string; message: string; pending: number;
  failed: boolean; tools: ReactNode; onComplete: (id: string) => void; onReveal: (id: string) => void;
};

export function RaidShowcase({ entryTargets, screen }: { entryTargets: RaidEntryTarget[]; screen?: RaidScreenPresentation }) {
  const [demoCue, setCue] = useState<ShowcaseCue>("idle");
  const cue = screen?.scene.cue ?? demoCue;
  const [iteration, setIteration] = useState(0);
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [demoBossHand, setBossHand] = useState<RaidHand>("paper");
  const bossHand = screen?.scene.bossHand ?? demoBossHand;
  const [rpsState, setRpsState] = useState<{ key: string; view: RpsView }>({ key: "", view: showcaseRpsFrame(0) });
  const [impactState, setImpactState] = useState<{ key: string; phase: ShowcaseFrame["phase"] }>({ key: "idle:0", phase: "idle" });
  const [renderer, setRenderer] = useState<"loading" | "webgl" | "fallback">("loading");
  const [fullscreenError, setFullscreenError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<ReturnType<typeof createShowcaseArena> | null>(null);
  const playback = useRef<ReturnType<typeof createShowcasePlayback> | null>(null);
  if (!playback.current) playback.current = createShowcasePlayback();
  const effects = useRef<HTMLDivElement>(null);
  const health = useRef<HTMLSpanElement>(null);
  const delayedHealth = useRef<HTMLSpanElement>(null);
  const context: RaidArenaContext | undefined = screen ? { members: screen.members, actorId: screen.scene.actorId, counterIds: screen.scene.counterIds } : undefined;
  const latest = useRef({ auto: false, paused: false, context, complete: screen?.onComplete });
  latest.current = { auto: !screen && auto, paused: !screen && paused, context, complete: screen?.onComplete };
  const fixture = showcaseScenes.find((item) => item.id === cue)!;
  const scene = screen?.scene ?? fixture;
  const { beforeHp, hp: targetHp, seconds } = scene;
  const maxHp = screen?.scene.maxHp ?? 450;
  const attacking = cue === "attack" || cue === "critical";
  const key = screen?.scene.id ?? `${cue}:${iteration}`;
  const phase = impactState.key === key ? impactState.phase : attacking ? "flight" : "idle";
  const hp = !attacking || phase === "reaction" ? targetHp : beforeHp;
  const rps = rpsState.key === key ? rpsState.view : showcaseRpsFrame(0, bossHand);
  const HandIcon = handIcons[rps.hand];
  const handLabel = raidHands.find((hand) => hand.id === rps.hand)!.label;

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const target = canvas.current!;
    const lost = (event: Event) => {
      event.preventDefault(); observer?.disconnect(); arena.current?.dispose(); arena.current = null; setRenderer("fallback");
    };
    const visibility = () => playback.current?.pause(latest.current.paused || document.hidden);
    target.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    void import("@/lib/raid-showcase-arena").then(({ createShowcaseArena }) => {
      if (cancelled) return;
      try {
        arena.current = createShowcaseArena(target);
        const rect = target.getBoundingClientRect(); arena.current.resize(rect.width, rect.height);
        observer = new ResizeObserver(([entry]) => arena.current?.resize(entry.contentRect.width, entry.contentRect.height));
        observer.observe(target); setRenderer("webgl");
      } catch { arena.current?.dispose(); arena.current = null; setRenderer("fallback"); }
    }).catch(() => { if (!cancelled) setRenderer("fallback"); });
    return () => { cancelled = true; observer?.disconnect(); target.removeEventListener("webglcontextlost", lost); document.removeEventListener("visibilitychange", visibility); arena.current?.dispose(); arena.current = null; };
  }, []);

  useEffect(() => {
    if (renderer === "loading") return;
    const clock = playback.current!;
    clock.play(cue, bossHand); clock.pause(latest.current.paused || document.hidden);
    const animations = effects.current?.getAnimations({ subtree: true }) ?? [];
    animations.forEach((animation) => { animation.pause(); animation.currentTime = 0; });
    let request = 0;
    let lastDraw = -Infinity;
    let completed = false;
    const tick = (now: number) => {
      request = requestAnimationFrame(tick);
      if (document.hidden) return;
      const frame = clock.sample();
      // Never skip a contact/release frame even when rendering is capped at 40fps.
      if (now - lastDraw < 25 && frame.phase === lastPhase) return;
      lastDraw = now; lastPhase = frame.phase;
      arena.current?.render(frame, latest.current.context);
      animations.forEach((animation) => { animation.currentTime = frame.visualMs; });
      const width = (progress: number) => `${(beforeHp + (targetHp - beforeHp) * progress) / maxHp * 100}%`;
      if (health.current) health.current.style.width = width(frame.hpProgress);
      if (delayedHealth.current) delayedHealth.current.style.width = width(frame.delayedHpProgress);
      setImpactState((previous) => previous.key === key && previous.phase === frame.phase ? previous : { key, phase: frame.phase });
      if (cue === "rps") {
        const { hand, revealed, beat } = showcaseRpsFrame(frame.visualMs, frame.bossHand);
        setRpsState((previous) => previous.key === key && previous.view.hand === hand && previous.view.revealed === revealed && previous.view.beat === beat ? previous : { key, view: { hand, revealed, beat } });
      }
      if (latest.current.complete && !completed && frame.elapsedMs >= seconds * 1000) { completed = true; latest.current.complete(key); }
      if (latest.current.auto && frame.elapsedMs >= seconds * 1000) {
        const index = showcaseScenes.findIndex((item) => item.id === cue);
        setCue(showcaseScenes[(index + 1) % showcaseScenes.length].id);
      }
    };
    let lastPhase: ShowcaseFrame["phase"] | null = null;
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [cue, key, renderer, bossHand, beforeHp, targetHp, maxHp, seconds]);

  useEffect(() => { playback.current?.pause((!screen && paused) || document.hidden); }, [paused, Boolean(screen)]);

  // Notify after the revealed hand has been committed to the screen, including the fallback renderer.
  const onReveal = screen?.onReveal;
  useEffect(() => {
    if (cue === "rps" && rpsState.key === key && rpsState.view.revealed) onReveal?.(key);
  }, [cue, key, rpsState.key, rpsState.view.revealed, onReveal]);

  function select(next: ShowcaseCue) { setAuto(false); setPaused(false); setCue(next); setIteration((value) => value + 1); }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();
      setFullscreenError("");
    } catch { setFullscreenError("全画面にできませんでした。ブラウザの全画面表示をお試しください。"); }
  }

  return <div className={styles.viewport}>
    <main className={`${styles.screen} ${styles[cue]} ${screen ? styles.liveScreen : ""}`} data-cue={cue} data-paused={!screen && paused} data-impact-phase={phase} data-actor-id={screen?.scene.actorId ?? undefined} aria-label={screen ? "会場レイドスクリーン" : "PC用レイド演出デモ"}>
      <div className={styles.honeycomb}/>
      <div className={styles.brand}>4<span>PRO</span><small>ONE TEAM. ONE RAID.</small></div>
      <div className={styles.demoBadge}>{screen?.status ?? "PC 演出デモ"}</div>
      <header className={styles.hud}>
        <div className={styles.bossTitle}><span>RAID BOSS / 01</span><h1>{screen?.bossName ?? "キング・アクア"}</h1><strong>{Math.round(hp / maxHp * 100)}<small>%</small></strong></div>
        <div className={styles.health} role="progressbar" aria-label={screen ? "ボスHP" : "演出デモのボスHP"} aria-valuenow={hp} aria-valuemin={0} aria-valuemax={maxHp}>
          <span ref={delayedHealth} className={styles.delayedHealth} style={{ width: `${beforeHp / maxHp * 100}%` }}/><span ref={health} className={styles.currentHealth} style={{ width: `${beforeHp / maxHp * 100}%` }}/>
        </div>
      </header>
      <section className={styles.arena} aria-label="ボスとエフェクト" data-renderer={renderer}>
        <div className={styles.floor}/>
        {renderer !== "webgl" && <div className={styles.fallback}><EnemyArt/></div>}
        <canvas ref={canvas} aria-label="キング・アクアと攻撃エフェクト" role="img"/>
        <div ref={effects} key={key} className={styles.effects} style={{ "--impact-delay": `${showcaseImpactMs}ms`, "--counter-impact-delay": `${counterImpactMs}ms`, "--rps-reveal-delay": `${rpsRevealMs}ms` } as CSSProperties} aria-hidden="true">
          {cue === "rps" && <div className={styles.rpsPresentation} data-revealed={rps.revealed} data-rps-hand={rps.hand}>
            <div className={styles.rpsRevealRing}/>
            <div className={styles.rpsCard}>
              <span className={styles.rpsEyebrow}>BOSS / じゃんけん</span>
              <span className={styles.rpsCall}>{["じゃん", "けん", "…", "ぽん！"][rps.beat]}</span>
              <div className={styles.rpsGlyph}><HandIcon strokeWidth={1.7}/></div>
              <strong className={styles.rpsHandName}>{rps.revealed ? handLabel : "ボスの手は…？"}</strong>
              <div className={styles.rpsChoices}>{raidHands.map(({ id }) => { const Icon = handIcons[id]; return <span key={id} data-active={rps.hand === id}><Icon/></span>; })}</div>
            </div>
          </div>}
          {(attacking || cue === "rps" || cue === "counter" || cue === "heal" || cue === "victory") && <div className={styles.sparkleCloud}>{Array.from({ length: cue === "critical" || cue === "counter" ? 36 : 18 }, (_, i) => {
            const size = .3 + i % 5 * .09;
            return <i key={i} style={{ left: `${54 + Math.sin(i * 12.7) * 28}%`, top: `${(cue === "counter" ? 65 : 46) + Math.cos(i * 7.3) * (cue === "counter" ? 20 : 30)}%`, width: `${size}cqw`, height: `${size}cqw`, animationDelay: `${(attacking ? showcaseImpactMs / 1000 : cue === "rps" ? rpsRevealMs / 1000 : cue === "counter" ? counterImpactMs / 1000 : .1) + i % 8 * .055}s` }}/>;
          })}</div>}
          {attacking && <><i className={styles.impactRing}/><i className={styles.impactRay}/><div className={styles.damage}><span>×{screen?.scene.multiplier ?? (cue === "critical" ? 2 : 1)}</span><strong>{screen?.scene.amount ?? (cue === "critical" ? 100 : 50)}</strong></div></>}
          {cue === "heal" && <div className={styles.healSymbols}><span>+</span><span>+</span><strong>+{screen?.scene.amount ?? 60}</strong><span>+</span></div>}
          {cue === "counter" && <div className={styles.waterWash}/>}
          {cue === "weaken" && <div className={styles.dangerPulse}/>}
          {cue === "victory" && <div className={styles.clear}><Trophy/><span>RAID COMPLETE</span><strong>討伐成功</strong></div>}
          {screen?.failed && <div className={styles.clear}><span>RAID FAILED</span><strong>討伐失敗</strong></div>}
        </div>
        {cue === "rps" && <p className={styles.srOnly} role="status">{rps.revealed ? `ボスの手は${handLabel}です` : "ボスがじゃんけんをしています"}</p>}
        {renderer === "loading" && <p className={styles.rendererNote} role="status">3D演出を準備しています…</p>}
        {renderer === "fallback" && <p className={styles.rendererNote} role="status">簡易表示 · 3D表示にはWebGL対応ブラウザを使用してください</p>}
      </section>
      <div className={styles.members}><Users/><strong>{screen ? screen.members.length : 12}<small>人</small></strong><span>{screen ? `生存 ${screen.members.filter((member) => member.hp > 0).length} 人` : "DEMO TEAM"}</span></div>
      <div className={styles.qr}><RaidJoinCard targets={entryTargets} local={screen?.local ?? false} compact={!screen}/></div>
      {screen && <ul className={styles.liveMembers} aria-label="参加者とキャラクター">{screen.members.map((member, i) => <li key={member.id} data-participant-id={member.id} data-character-id={member.characterId} data-active={screen.scene.actorId === member.id} style={{ "--member-color": `#${(characterColors[member.characterId] ?? 0xb18aff).toString(16).padStart(6, "0")}` } as CSSProperties}><b>{String(i + 1).padStart(2, "0")}</b><span>{member.nickname}<small>{member.characterName}</small></span><strong>{member.hp}<small> / {member.maxHp}</small></strong></li>)}</ul>}
      {!screen && <div className={styles.controls} aria-label="演出デモの操作">
        {cue === "rps" && <div className={styles.rpsPicker} role="group" aria-label="デモのボスの手"><span>デモの手</span>{raidHands.map(({ id, label }) => {
          const Icon = handIcons[id];
          return <button type="button" key={id} aria-label={`${label}で再生`} aria-pressed={bossHand === id} onClick={() => { setBossHand(id); select("rps"); }}><Icon/>{label}</button>;
        })}</div>}
        <div className={styles.playback}>
          <button type="button" disabled={renderer === "loading"} className={auto ? styles.active : ""} aria-pressed={auto} onClick={() => { setAuto((value) => !value); setPaused(false); if (cue === "victory") { setCue("idle"); setIteration((value) => value + 1); } }}><Play/>連続デモ</button>
          <button type="button" aria-label={paused ? "演出を再開" : "演出を一時停止"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play/> : <Pause/>}</button>
          <button type="button" aria-label="今の演出をもう一度" onClick={() => { setPaused(false); setIteration((value) => value + 1); }}><RotateCcw/></button>
        </div>
        <div className={styles.scenes} role="group" aria-label="演出を選ぶ">{showcaseScenes.map((item) => {
          const Icon = icons[item.id];
          return <button type="button" key={item.id} disabled={renderer === "loading"} aria-pressed={cue === item.id} onClick={() => select(item.id)}><Icon/><span>{item.label}</span></button>;
        })}</div>
      </div>}
      {screen && <footer className={styles.liveFooter}><strong>{screen.title}</strong><p>{screen.message}</p>{screen.pending > 0 && <small>演出待ち {screen.pending} 件</small>}</footer>}
      <div className={styles.tools}>{screen ? <><a href="/raid/screen?demo=effects">演出確認ページ</a>{screen.tools}</> : <a href="/raid/screen?sync=local">同期スクリーンへ戻る</a>}<button type="button" aria-label="全画面で表示" onClick={fullscreen}><Expand/></button></div>
      {!screen && <p className={styles.caption} role="status">{fixture.label} <span>／ 人数・HPはデモ用の表示です</span></p>}
      {fullscreenError && <p className={styles.error} role="alert">{fullscreenError}</p>}
    </main>
  </div>;
}
