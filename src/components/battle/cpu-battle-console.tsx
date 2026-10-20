"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw, Shield, Sparkles, Swords } from "lucide-react";
import type { PartnerView } from "@/lib/character-presentation";
import { chooseCpuAction, cpuRules, createCpuBattle, damage, practiceFighter, resolveCpuTurn, type CpuAction, type CpuBattle } from "@/lib/cpu-battle";
import { isTemporaryCharacter } from "@/lib/master-data";
import { CharacterArt } from "../character-art";
import { EnemyArt } from "./enemy-art";
import styles from "./cpu-battle.module.css";

const actions = [
  { id: "attack", name: "攻撃", icon: Swords },
  { id: "defend", name: "防御", icon: Shield },
  { id: "special", name: "必殺", icon: Sparkles },
] as const;
const actionName = { attack: "攻撃", defend: "防御", special: "必殺" };
type Phase = "ready" | "player" | "cpu" | "settle";

function PracticeArt({ partner, className }: { partner: PartnerView; className?: string }) {
  // Trial art is visible only in CPU practice; collection ownership stays unchanged.
  if (!isTemporaryCharacter(partner.id)) return <CharacterArt element={partner.element} className={className}/>;
  const colors = ["#589d88", "#bd8241", "#cd5867", "#568dae"];
  const color = colors[partner.number % colors.length];
  return <svg viewBox="0 0 240 200" className={className} aria-hidden="true">
    <ellipse cx="120" cy="179" rx="65" ry="9" fill={color} opacity=".16"/>
    <g stroke={color} strokeWidth="4" strokeLinejoin="round">
      <path d="m73 97-22 18-5 33 24 6 21-39m76-18 22 18 5 33-24 6-21-39" fill="#e8edf0"/>
      <path d="m90 130-8 39 25 4 13-37 13 37 25-4-8-39" fill={color}/>
      <path d="m84 93 36-17 36 17-8 49H92Z" fill="#f7fafb"/>
      <path d="m87 47 33-18 33 18 4 36-37 22-37-22Z" fill={color}/>
      <path d="m101 64 12 3m14 0 12-3" stroke="#fff" strokeWidth="6"/>
    </g>
    <text x="120" y="129" textAnchor="middle" fontSize="22" fontWeight="900" fill={color}>{String(partner.number).padStart(2, "0")}</text>
  </svg>;
}

function Meter({ label, value, max, ep = false }: { label: string; value: number; max: number; ep?: boolean }) {
  return <div className={`${styles.meter} ${ep ? styles.epMeter : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
    <span style={{ width: `${Math.min(100, value / max * 100)}%` }}/>
  </div>;
}

export function CpuBattleConsole({ partners }: { partners: PartnerView[] }) {
  const [selectedId, setSelectedId] = useState(partners[0]?.id ?? "");
  const [battle, setBattle] = useState<CpuBattle | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [exchange, setExchange] = useState<CpuBattle["lastTurn"]>(null);
  const [ready, setReady] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setReady(true); return () => { if (timer.current) clearTimeout(timer.current); }; }, []);
  const selected = partners.find((partner) => partner.id === selectedId) ?? partners[0];
  if (!selected) return <div className="empty-panel">キャラクターを準備しています。</div>;
  const fighter = practiceFighter(selected);
  const busy = phase !== "ready";

  function start() {
    setExchange(null);
    setPhase("ready");
    setBattle(createCpuBattle(fighter));
  }

  function play(action: CpuAction) {
    if (locked.current || !battle || battle.result !== "playing") return;
    const next = resolveCpuTurn(battle, action);
    if (next === battle) return;
    locked.current = true;
    setExchange(next.lastTurn);
    setPhase("player");
    // Reveal each side's action and HP change in sequence. Both commands are
    // committed for the turn, so a finishing hit does not cancel a counterattack.
    timer.current = setTimeout(() => {
      setBattle({ ...battle, cpuHp: next.cpuHp, playerEp: next.playerEp });
      setPhase("cpu");
      timer.current = setTimeout(() => {
        setBattle(next);
        setPhase("settle");
        timer.current = setTimeout(() => {
          locked.current = false;
          setPhase("ready");
          timer.current = null;
        }, 300);
      }, cpuRules.actionDelayMs);
    }, cpuRules.actionDelayMs);
  }
  const intent = battle ? busy && exchange ? exchange.cpuAction : chooseCpuAction(battle) : "attack";
  const last = exchange ?? battle?.lastTurn;
  const ended = battle !== null && battle.result !== "playing";
  const forecast = intent === "special" ? "必殺の予兆！ 防御でしのごう" : intent === "defend" ? "防御で力をためている" : "こちらに攻撃を仕掛ける";
  const message = phase === "player" && last ? `あなたの${actionName[last.playerAction]}！${last.playerAction === "defend" ? " 盾を構えた" : ` ${last.damageToCpu}ダメージ`}`
    : phase === "cpu" && last ? `${battle!.cpu.name}の${actionName[last.cpuAction]}！${last.cpuAction === "defend" ? " 攻撃に備えている" : ` ${last.damageToPlayer}ダメージ`}`
    : last ? `あなたの${actionName[last.playerAction]}：${last.damageToCpu} ／ 相手の${actionName[last.cpuAction]}：${last.damageToPlayer}ダメージ`
    : "相手の予告を見て、行動を選ぼう。";

  return <div className={styles.screen}>
    <div className={styles.heading}><h1><Swords size={20}/>CPU対戦</h1><Link href="/battle/raid">レイド画面<ArrowRight size={14}/></Link></div>
    {!battle ? <section className={styles.picker} aria-label="CPU対戦のキャラ選択">
      <div className={styles.intro}><h2>使うキャラを1体選ぼう</h2><p>全{partners.length}体をお試しできます。仮ルール・報酬なし。</p></div>
      <div className={styles.choices} role="group" aria-label="対戦キャラクター">
        {partners.map((partner) => <button
          type="button" key={partner.id} className={`${styles.choice} ${selected.id === partner.id ? styles.chosen : ""}`}
          aria-label={`${partner.name}を選択`} aria-pressed={selected.id === partner.id} disabled={!ready} onClick={() => setSelectedId(partner.id)}
        >
          <span className={styles.number}>{String(partner.number).padStart(2, "0")}</span>
          {selected.id === partner.id && <Check size={13} className={styles.check}/>}
          <PracticeArt partner={partner} className={styles.choiceArt}/>
          <span className={styles.choiceName}>{partner.name}</span>
        </button>)}
      </div>
      <div className={styles.selectionFooter}>
        <div><strong>{selected.name}</strong><small>HP {fighter.maxHp}　攻撃 {fighter.attack}　防御 {fighter.defense}</small></div>
        <button type="button" className={styles.primary} disabled={!ready} onClick={start}>このキャラで対戦<ArrowRight size={17}/></button>
      </div>
    </section> : <div className={styles.fight}>
      <section className={styles.battlefield} aria-label="CPUの対戦画面" data-phase={phase}>
        <div className={styles.cpuHud}>
          <div><span className={styles.eyebrow}>対戦相手 · CPU</span><h2>{battle.cpu.name}</h2><Meter label="CPUのHP" value={battle.cpuHp} max={battle.cpu.maxHp}/><small>HP {battle.cpuHp} / {battle.cpu.maxHp}　EP {battle.cpuEp} / {cpuRules.maxEp}</small></div>
          <div className={styles.turn}><span>TURN</span><strong>{Math.min(ended ? battle.turn : battle.turn + 1, cpuRules.maxTurns).toString().padStart(2, "0")}</strong><small>/ {cpuRules.maxTurns}</small></div>
        </div>
        <div className={`${styles.forecast} ${intent === "special" ? styles.danger : ""}`} aria-label="相手の次の行動">
          <span>{ended ? "対戦終了" : busy ? "このターンの行動" : "相手の次の行動"}</span>
          <strong>{ended ? "おつかれさま！" : `${actionName[intent]} · ${forecast}`}</strong>
          {!ended && <small>{intent === "defend" ? "与えるダメージが減少" : `防御しないと ${damage(battle.cpu, battle.player, intent, false)} ダメージ`}</small>}
        </div>
        <div className={`${styles.arena} ${phase === "player" && last?.playerAction === "special" || phase === "cpu" && last?.cpuAction === "special" ? styles.burst : ""}`}>
          <div className={styles.arenaMark} aria-hidden="true">VS</div>
          <div className={`${styles.combatant} ${styles.playerFighter} ${phase === "player" && last?.playerAction !== "defend" ? styles.playerAttacking : ""} ${phase === "cpu" && last?.damageToPlayer ? styles.hit : ""}`} role="img" aria-label={`自分のキャラ：${selected.name}`}>
            <PracticeArt partner={selected}/>
            {busy && last?.playerAction === "defend" && <span className={styles.guard}><Shield/><small>GUARD</small></span>}
            {phase === "cpu" && !!last?.damageToPlayer && <b className={`${styles.damage} ${last.playerAction === "defend" ? styles.blocked : ""}`}>−{last.damageToPlayer}</b>}
            <span className={styles.fighterTag}>YOU · お試し</span>
          </div>
          <div className={`${styles.combatant} ${styles.cpuFighter} ${phase === "cpu" && last?.cpuAction !== "defend" ? styles.cpuAttacking : ""} ${phase === "player" && last?.damageToCpu ? styles.hit : ""}`} role="img" aria-label={`敵のキャラ：${battle.cpu.name}`}>
            <EnemyArt/>
            {!ended && intent === "defend" && <span className={styles.guard}><Shield/><small>GUARD</small></span>}
            {phase === "player" && !!last?.damageToCpu && <b className={styles.damage}>−{last.damageToCpu}</b>}
            {battle.cpuOpening && !busy && !ended && <span className={styles.opening}>隙あり！ ダメージ ×1.5</span>}
            <span className={styles.fighterTag}>CPU</span>
          </div>
        </div>
        <p className={styles.log} role="status" aria-live="polite">{message}</p>
        {ended && <div className={styles.result} role="region" aria-label="対戦結果">
          <span>{battle.result === "win" ? "VICTORY" : battle.result === "lose" ? "DEFEAT" : "DRAW"}</span>
          <h2>{battle.result === "win" ? "勝利！" : battle.result === "lose" ? "敗北" : "引き分け"}</h2>
          <p>{battle.turn}ターンで対戦終了</p>
          <small>{battle.result === "lose" ? "必殺を防ぎ、直後の隙に反撃しよう。" : "攻撃と防御のタイミングが勝負のカギ。"}</small>
        </div>}
      </section>

      <section className={styles.controls} aria-label="CPU対戦の操作">
        <div className={styles.playerHud}>
          <div className={styles.playerVitals}><span className={styles.eyebrow}>YOUR PARTNER</span><strong>{selected.name}</strong><Meter label="自分のHP" value={battle.playerHp} max={battle.player.maxHp}/><small>HP {battle.playerHp} / {battle.player.maxHp}</small></div>
          <div className={`${styles.ep} ${battle.playerEp >= cpuRules.specialCost ? styles.charged : ""}`}><span>必殺ゲージ（EP）</span><strong>{battle.playerEp}<small> / {cpuRules.maxEp}</small></strong><Meter label="必殺ゲージ（EP）" value={battle.playerEp} max={cpuRules.maxEp} ep/></div>
        </div>
        <div className={styles.commands} role="group" aria-label="行動を選ぶ">
          {actions.map((item) => <button type="button" key={item.id} aria-label={item.name}
            className={`${styles.command} ${item.id === "special" ? styles.special : ""}`}
            disabled={busy || ended || (item.id === "special" && battle.playerEp < cpuRules.specialCost)} onClick={() => play(item.id)}
          ><item.icon size={23}/><strong>{item.name}</strong><small>{item.id === "special" ? `EP ${cpuRules.specialCost} で発動` : item.id === "defend" ? "軽減 ＋ EPボーナス" : "ダメージ ＋ EP"}</small></button>)}
        </div>
        <p className={styles.hint}>{ended ? "もう一度挑戦してみよう。" : busy ? "行動中…" : battle.cpuOpening ? "必殺のあとは隙あり！ 攻撃・必殺で反撃しよう。" : intent === "special" ? "防御でダメージ65%軽減。防ぐとEPも多くたまる！" : intent === "defend" ? "相手は防御中。必殺を温存して次に備えよう。" : "攻撃で削る？ 防御でEPをためる？"}</p>
      </section>
      <div className={styles.battleFooter}>
        <button type="button" disabled={busy} onClick={() => { setBattle(null); setExchange(null); }}>キャラを選び直す</button>
        {ended ? <button type="button" disabled={busy} onClick={start}><RotateCcw size={15}/>もう一度対戦</button> : <span>仮ルール · 勝敗は保存されません</span>}
      </div>
    </div>}
  </div>;
}
