"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, ChevronsRight, CircleHelp, Crown, Droplets, Flame, Hand, HandFist, Heart, Leaf, LoaderCircle, Monitor, Radio, Repeat2, Scissors, Sparkles, Swords, Trophy, UsersRound, X, Zap } from "lucide-react";
import type { PartnerView } from "@/lib/character-presentation";
import type { LocalRaidAction, LocalRaidResult } from "@/lib/local-raid-types";
import { visibleLocalRaid } from "@/lib/local-raid-presentation";
import { battlePreview } from "@/lib/battle-preview";
import { raidHands, raidRpsRules, resolveRaidRps, type RaidHand } from "@/lib/raid-rps";
import { localRequestId, useLocalRaid } from "./use-local-raid";
import { useRaidCountdown } from "./use-raid-countdown";
import { PartnerScene } from "./partner-scene";
import { RaidHpGauge } from "./raid-hp-gauge";
import { LocalRaidGuide } from "./local-raid-guide";
import styles from "./raid-mobile.module.css";

type ResultView = Pick<LocalRaidResult, "action" | "hand" | "boss" | "outcome" | "label" | "multiplier" | "amount" | "counterDamage"> & { key: string; submitted?: boolean };
type Attempt = { type: "command"; roomId: string; round: number; requestId: string; action: LocalRaidAction; hand: RaidHand };
const handIcons = { rock: HandFist, scissors: Scissors, paper: Hand };
const colors: Record<string, string> = { FOREST: "#49a878", THUNDER: "#e1a52d", FLAME: "#e05d5c", AQUA: "#319fca", LEGEND: "#9d74d9" };
const elements = { FOREST: { label:"森属性",Icon:Leaf }, THUNDER: { label:"雷属性",Icon:Zap }, FLAME: { label:"炎属性",Icon:Flame }, AQUA: { label:"水属性",Icon:Droplets }, LEGEND: { label:"レジェンド",Icon:Crown } };
const handName = (hand: RaidHand) => raidHands.find((item) => item.id === hand)!.label;

export function RaidMobileConsole({ partners, local = false, production = false }: { partners: PartnerView[]; local?: boolean; production?: boolean }) {
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { setInteractive(true); }, []);
  const { state: raw, error: connectionError, send } = useLocalRaid(local, true, production ? "/api/raid" : "/api/local-raid");
  const state = raw ? visibleLocalRaid(raw) : null;
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [action, setAction] = useState<LocalRaidAction | null>(local ? null : "attack");
  const [hand, setHand] = useState<RaidHand | null>(null);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [previewWaiting, setPreviewWaiting] = useState(false);
  const [result, setResult] = useState<ResultView | null>(null);
  const [impact, setImpact] = useState<{ key: string; kind: "heal" | "counter"; amount: number } | null>(null);
  const impactSeen = useRef({ roomId: "", action: 0, counter: 0 });
  const seen = useRef({ roomId: "", turn: 0 });
  const joined = useRef("");
  const token = useRef(0);
  const locked = useRef(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const help = useRef<HTMLDialogElement>(null);
  const partner = partners.find((item) => item.id === partnerId) ?? partners[0];
  const seconds = useRaidCountdown(raw?.round.closesAt, raw?.serverNow);
  const submitted = raw?.me?.submission?.round === raw?.round.number && Boolean(raw?.me?.submission);
  const sentCommand = local && submitted ? raw?.me?.submission : null;
  const pendingCommand = sentCommand ?? (local && sending ? attempt : null);
  const SentHandIcon = pendingCommand ? handIcons[pendingCommand.hand] : null;
  const accepting = !local || Boolean(raw?.round.phase === "collecting" && seconds > 0 && raw.me && raw.me.eligibleRound <= raw.round.number);
  const waiting = previewWaiting || Boolean(local && (raw?.round.phase === "playing" || (raw?.round.phase === "collecting" && submitted)));
  const phase = result ? "result" : waiting ? "waiting" : sending ? "sending" : "select";
  const busy = phase !== "select";

  const join = useCallback(async () => {
    setJoining(true); setError("");
    try { await send({ type: "join", characterId: partnerId }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "参加に失敗しました。"); }
    finally { setJoining(false); }
  }, [send, partnerId]);
  useEffect(() => {
    if (!local || !raw || !partnerId || raw.me?.characterId === partnerId) return;
    if (seen.current.roomId !== raw.roomId && raw.me && partners.some((item) => item.id === raw.me!.characterId)) {
      setPartnerId(raw.me.characterId);
      return;
    }
    const key = `${raw.roomId}:${partnerId}`;
    if (joined.current === key) return;
    joined.current = key;
    void join();
  }, [local, raw?.roomId, raw?.me?.characterId, partnerId, join]);
  const inputRound = useRef(0);
  useEffect(() => {
    if (raw?.round.phase !== "collecting" || inputRound.current === raw.round.number) return;
    inputRound.current = raw.round.number;
    token.current++; locked.current = false;
    setResult(null); setHand(null); setAttempt(null); setSending(false); setError("");
    if (local) setAction(null);
  }, [raw?.roomId, raw?.round.number, raw?.round.phase]);

  useEffect(() => {
    if (!raw) return;
    const latest = raw.me?.lastResult;
    if (seen.current.roomId !== raw.roomId) {
      seen.current = { roomId: raw.roomId, turn: latest && latest.turn <= raw.revealedTurn ? latest.turn : 0 };
      token.current++; locked.current = false;
      inputRound.current = 0;
      setResult(null); setHand(null); setAttempt(null); setSending(false); setError("");
      if (local) setAction(null);
      return;
    }
    if (!latest || latest.turn > raw.revealedTurn || latest.turn <= seen.current.turn) return;
    seen.current.turn = latest.turn;
    setResult({ ...latest, key: `${raw.roomId}:${latest.turn}` });
    setAttempt(null); setError("");
  }, [raw?.roomId, raw?.me?.lastResult?.turn, raw?.revealedTurn]);

  useEffect(() => {
    if (!raw) return;
    if (impactSeen.current.roomId !== raw.roomId) {
      impactSeen.current = { roomId: raw.roomId, action: raw.actionTurn, counter: raw.counterTurn };
      setImpact(null);
      return;
    }
    const id = raw.me?.lastResult?.participantId;
    const mine = raw.results.filter((entry) => entry.participantId === id && entry.characterId === raw.me?.characterId);
    const counter = mine.findLast((entry) => entry.turn > impactSeen.current.counter && entry.turn <= raw.counterTurn && entry.counterDamage > 0);
    const heal = mine.findLast((entry) => entry.turn > impactSeen.current.action && entry.turn <= raw.actionTurn && entry.action === "heal" && entry.amount > 0);
    if (counter || heal) {
      const entry = (counter ?? heal)!;
      setImpact({ key: `${raw.roomId}:${entry.turn}:${counter ? "counter" : "heal"}`, kind: counter ? "counter" : "heal", amount: counter ? entry.counterDamage : entry.amount });
    }
    impactSeen.current = { roomId: raw.roomId, action: raw.actionTurn, counter: raw.counterTurn };
  }, [raw?.roomId, raw?.actionTurn, raw?.counterTurn, raw?.me?.lastResult?.participantId]);
  useEffect(() => {
    if (!impact) return;
    const timer = setTimeout(() => setImpact(null), 1500);
    return () => clearTimeout(timer);
  }, [impact?.key]);

  // Synced results remain visible until the next shared input round starts.
  useEffect(() => {
    if (!result || local) return;
    const timer = setTimeout(() => { setResult(null); setHand(null); setAttempt(null); }, 2000);
    return () => clearTimeout(timer);
  }, [result?.key, local]);
  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);

  if (!partner) return <div className="empty-panel">キャラクター情報を準備しています。</div>;
  const maxHp = state?.me?.maxHp ?? partner.stats[0].value;
  const hp = state?.me?.hp ?? maxHp;
  const bossHp = local ? state?.bossHp : battlePreview.bossHp;
  const bossMaxHp = state?.bossMaxHp ?? battlePreview.bossHp;
  const ended = local && (bossHp === 0 || hp <= 0);
  const ready = interactive && (!local || Boolean(state?.me && state.me.characterId === partnerId && !joining && !connectionError));
  const frozen = busy || joining || Boolean(attempt) || ended || !accepting;
  const characterFrozen = !interactive || busy || joining || Boolean(attempt) || ended || Boolean(local && raw?.round.phase !== "lobby" && !accepting);
  const unsettled = Boolean(raw?.me?.lastResult && raw.me.lastResult.turn > raw.counterTurn);
  const feedback = local ? impact?.kind === "heal" ? "heal" : result?.submitted === false ? "idle" : result?.outcome ?? "idle" : result ? result.action === "heal" ? "heal" : result.outcome : "idle";
  const status = connectionError || error || (joining ? "レイドへ参加しています…" : local && !raw ? "会場に接続しています…"
    : local && !state?.me ? "参加して、仲間と一緒に戦おう" : local && raw?.round.phase === "lobby" ? "会場スクリーンで受付を開始すると参加できます"
      : result ? result.submitted === false ? "今回は未入力でした。次の受付で参加しよう" : `${result.label} ×${result.multiplier}：${result.action === "attack" ? "攻撃" : "自己回復"} ${result.amount} ／ ボスの全体攻撃 ${result.counterDamage}`
      : waiting ? local ? submitted && raw?.round.phase === "collecting" ? "送信済み。締め切りまでスクリーンに注目！" : "みんなの行動をスクリーンで見届けよう！" : "ボスとじゃんけん中…"
      : sending ? "選んだ手を送信しています…"
        : ended ? bossHp === 0 ? "討伐成功！ みんなでボスを倒した！" : "戦闘不能です。次のレイドで再挑戦しよう" : local ? action ? "手をタップすると、そのまま送信します" : "先に攻撃か回復を選ぼう" : "攻撃・回復と、じゃんけんの手を選ぼう");

  async function submit(chosenHand = hand) {
    if (locked.current || busy || ended || !chosenHand || !action || !ready || !accepting || (local && submitted)) return;
    locked.current = true;
    const current = ++token.current;
    setError("");
    if (!local) {
      setPreviewWaiting(true);
      const chosenAction = action;
      previewTimer.current = setTimeout(() => {
        const boss = raidHands[Math.floor(Math.random() * raidHands.length)].id;
        const rps = resolveRaidRps(chosenHand, boss);
        const base = chosenAction === "attack" ? battlePreview.baseAttack : battlePreview.baseSelfHeal;
        setPreviewWaiting(false);
        setResult({ key: localRequestId(), action: chosenAction, hand: chosenHand, boss, ...rps, amount: base * rps.multiplier, counterDamage: 0 });
        locked.current = false;
      }, 2100);
      return;
    }
    const payload = attempt ?? { type: "command" as const, roomId: raw!.roomId, round: raw!.round.number, requestId: localRequestId(), action, hand: chosenHand };
    setAttempt(payload); setSending(true);
    try { await send(payload); }
    catch (reason) { if (current === token.current) setError(reason instanceof Error ? reason.message : "送信に失敗しました。同じ行動を再送できます。"); }
    finally { if (current === token.current) { setSending(false); locked.current = false; } }
  }

  const victory = local && bossHp === 0;
  const summary = result ?? (state?.me?.lastResult?.turn === raw?.round.number ? state?.me?.lastResult : null);
  const selectedHand = sentCommand?.hand ?? hand;
  const estimateBase = action === "attack" ? battlePreview.baseAttack : battlePreview.baseSelfHeal;
  const effectLimit = action === "attack" ? bossHp ?? battlePreview.bossHp : Math.max(0, maxHp - hp);
  const effectRange = [.5, 2].map((multiplier) => Math.min(effectLimit, estimateBase * multiplier));
  const element = elements[partner.element as keyof typeof elements] ?? elements.LEGEND;
  const ElementIcon = element.Icon;
  const retry = local && Boolean(attempt && error) && !busy && !ended && accepting;
  const rejoin = local && interactive && Boolean(raw) && !joining && !busy && !ended && raw?.me?.characterId !== partnerId;
  const localStatus = ended ? "戦闘不能" : sending ? "送信中…" : waiting || result ? "次の受付まで待機" : joining ? "参加中…" : !accepting ? "受付開始を待っています" : !action ? "① 攻撃か回復を選ぼう" : "② 手をタップして決定";
  function selectPartner(id: string) { if(characterFrozen || unsettled) return; setPartnerId(id); setHand(null); setError(""); }
  function cyclePartner(direction: number) { selectPartner(partners[(partners.findIndex((item)=>item.id===partner.id)+direction+partners.length)%partners.length].id); }

  return <div className={`${styles.console} ${styles.partnerLayout} ${local ? styles.localConsole : ""}`} data-phase={victory ? "victory" : phase}>
    <section className={styles.bossPanel} aria-label="ボスの状況" data-defeated={victory}>
      <div className={styles.bossHeading}><div><span className={styles.live}><Radio size={11}/>{local ? connectionError ? "再接続中" : raw ? "LIVE" : "接続中" : "PREVIEW"}</span><h2>{state?.bossName ?? battlePreview.bossName}</h2></div></div>
      <div className={styles.bossHealth}><RaidHpGauge value={bossHp ?? null} max={bossMaxHp} caption="BOSS HP" label={`ボスHP（${local ? "同期" : "プレビュー"}）`}/></div>
      <div className={styles.bossMeta}><span className={styles.round}><span>ROUND</span><strong>{raw?.round.number ? String(raw.round.number).padStart(2, "0") : "—"}</strong></span><span><UsersRound size={14}/>参加人数 <b>{state?.participants ?? "—"}</b><small>/ 20</small></span><span><Radio size={13}/>{local && raw?.round.phase === "collecting" ? `受付 あと${seconds}秒` : local ? connectionError ? "再接続しています" : raw ? "会場スクリーンと同期中" : "会場に接続中" : "操作プレビュー"}</span></div>
    </section>

    <section className={styles.hero} aria-label="自分のキャラクター" data-feedback={feedback} data-reaction={impact?.kind ?? "idle"} style={{ "--partner-color": colors[partner.element] ?? colors.LEGEND } as CSSProperties}>
      {local ? <h2 className="sr-only">{partner.name}・{element.label}・{partner.department}</h2> : <div className={styles.portraitHeading}><div className={styles.partnerIdentity}><div className={styles.partnerHeading}><span>YOUR PARTNER</span><span className={styles.partnerBadge}>{partner.owned ? "MY PARTNER" : "体験"}</span></div><h2>{partner.name}</h2><div className={styles.partnerTags}><span className={styles.elementBadge}><ElementIcon size={13}/>{element.label}</span><span title={partner.department}>{partner.department}</span></div></div><div className={styles.partnerSelect}><label className="sr-only" htmlFor="raid-mobile-partner">参加キャラクター</label><select id="raid-mobile-partner" value={partner.id} disabled={characterFrozen || unsettled} onChange={(event) => selectPartner(event.target.value)}>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span aria-hidden="true"><Repeat2 size={15}/>パートナー変更</span></div></div>}
      <div className={styles.characterStage}>
        {local && <div className={styles.localPartnerSelect} title={`パートナー変更：${partner.name}`}><select aria-label="参加キャラクター" value={partner.id} disabled={characterFrozen || unsettled} onChange={event=>selectPartner(event.target.value)}>{partners.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><Repeat2 size={17} aria-hidden="true"/></div>}
        <div className={styles.stageScenery} aria-hidden="true"><div className={styles.portalFloor}/>{Array.from({length:6},(_,i)=><i key={i} style={{"--prism":i} as CSSProperties}/>)}</div>
        <div className={styles.characterEffects} data-counter={impact?.kind === "counter"}>
          <div className={styles.character} role="img" aria-label={`${partner.name}：正面を向いた自分のキャラクター`}><PartnerScene element={partner.element} characterId={partner.id} imageUrl={partner.imageUrl}/></div>
          {(result || impact) && <div key={impact?.key ?? result?.key} className={styles.particles} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <Sparkles key={i} style={{ "--i": i } as CSSProperties}/>)}</div>}
          {(impact?.kind === "heal" || (!local && result?.action === "heal")) && <span className={styles.healNumber}>+{impact?.kind === "heal" ? impact.amount : result!.amount}<Heart size={18}/></span>}
          {impact?.kind === "counter" && <span className={styles.hitNumber}>−{impact.amount}</span>}
        </div>
        <button type="button" className={`${styles.partnerArrow} ${styles.previousPartner}`} aria-label="前のパートナー" disabled={characterFrozen || unsettled || partners.length<2} onClick={()=>cyclePartner(-1)}><ChevronLeft size={30}/></button><button type="button" className={`${styles.partnerArrow} ${styles.nextPartner}`} aria-label="次のパートナー" disabled={characterFrozen || unsettled || partners.length<2} onClick={()=>cyclePartner(1)}><ChevronRight size={30}/></button>
      </div>
      <RaidHpGauge value={hp} max={maxHp} caption="自分のHP" label={`自分のHP（${local ? "同期" : "プレビュー"}）`}/>
    </section>

    {victory ? <section className={`${styles.controls} ${styles.victory}`} aria-label="討伐成功の結果">
      {local && <div className={styles.confetti} aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{"--i":i} as CSSProperties}/>)}</div>}
      <div className={styles.victoryHeading}>{local ? <><span>BATTLE RESULT</span><Trophy size={42}/></> : <><Trophy size={30}/><span>RAID COMPLETE</span></>}<h2>討伐成功！</h2>{!local && <p>みんなの力でボスを倒した！</p>}</div>
      <div className={local ? "sr-only" : styles.victoryStats}><div><span>今回の勝敗</span><strong>{summary ? summary.submitted === false ? "未入力" : `${summary.label} ×${summary.multiplier}` : "—"}</strong></div><div><span>{summary?.action === "heal" ? "自己回復" : "攻撃値"}</span><strong>{summary?.amount ?? "—"}</strong></div><div><span>ボスの反撃</span><strong>{summary?.counterDamage ?? "—"}</strong></div></div>
      {!local && <p>次のレイド開始は会場スクリーンでお知らせします。</p>}<Link className={styles.victoryLink} href="/">ホームへ戻る <ArrowUpRight size={18}/></Link>
    </section> : <section className={styles.controls} aria-label="スマホ操作画面">
      <div className={styles.controlHeading}><span>{local && raw?.round.phase === "collecting" ? <><b className={styles.countdown} role="timer" aria-label="入力締め切りまで">あと{seconds}秒</b><small>{raw.round.submitted}/{raw.round.eligible}人 送信済み</small></> : phase === "select" ? "COMMAND SELECT" : phase === "result" ? "BATTLE RESULT" : "LOOK UP!"}</span><button type="button" aria-label="レイドのルールを開く" onClick={() => help.current?.showModal()}><CircleHelp size={19}/></button></div>
      <div className={styles.commandArea}>
        {phase === "select" ? <>
          <div className={styles.actionRow} role="group" aria-label="行動を選ぶ">{([{ id: "attack", label: "攻撃", Icon: Swords }, { id: "heal", label: "回復", Icon: Heart }] as const).map(({ id, label, Icon }) => <button type="button" key={id} aria-label={`${label}を選択`} aria-pressed={action === id} disabled={frozen || !ready} onClick={() => setAction(id)}><Icon size={19}/><strong>{label}</strong>{action === id && <Check size={14}/>}</button>)}</div>
          <div className={styles.handRow} role="group" aria-label="じゃんけんの手を選ぶ">{raidHands.map((item) => { const Icon = handIcons[item.id]; return <button type="button" key={item.id} data-hand={item.id} aria-label={`${item.label}を選択`} aria-pressed={hand === item.id} disabled={frozen || !ready || (local && !action)} onClick={() => { setHand(item.id); if (local) void submit(item.id); }}><span><Icon size={34}/><strong>{item.label}</strong></span>{hand === item.id && <Check className={styles.handCheck} size={20} aria-hidden="true"/>}</button>; })}</div>
          <div className={styles.prediction} aria-label="選択中の手と効果の目安"><div><span>選択中 <b>{selectedHand ? handName(selectedHand) : "手を選ぼう"}</b></span><span>{action ? action === "attack" ? "攻撃" : "回復" : "効果"}の目安 <b>{action ? `${effectRange[0]}–${effectRange[1]}` : "—"}</b></span></div><small>勝ち ×2 ・ あいこ ×1 ・ 負け ×0.5</small></div>
        </> : phase === "result" && result ? local ? <div key={result.key} className={`${styles.localResult} raid-rps-result`} data-outcome={result.outcome} data-submitted={result.submitted !== false}>
          {result.submitted === false && <strong className={styles.noInput}>今回は未入力です</strong>}
          <div className={styles.resultHands} aria-hidden="true">{raidHands.map(item=>{const Icon=handIcons[item.id];return <span key={item.id}><Icon size={30}/></span>;})}</div>
          {result.submitted === false ? <p>次のラウンドで行動を選んでください。</p> : <><strong className={styles.resultOutcome}>{result.label} <b>×{result.multiplier}</b></strong><small>自分：{handName(result.hand)} ／ ボス：{handName(result.boss)}<br/>{result.action === "attack" ? "攻撃" : "自己回復"} {result.amount} ・ 全体攻撃 {result.counterDamage}</small></>}
        </div> : <div key={result.key} className={`${styles.result} raid-rps-result`} data-outcome={result.outcome}>
          <span>{result.submitted === false ? "今回は未入力" : `自分：${handName(result.hand)}`} / ボス：{handName(result.boss)}</span><strong>{result.label} {result.submitted !== false && <b>×{result.multiplier}</b>}</strong><span>{result.submitted === false ? "次のラウンドで行動を選ぼう" : <>{result.action === "attack" ? "攻撃" : "自己回復"} <b>{result.amount}</b></>}{local && <> ／ 全体攻撃 {result.counterDamage}</>}</span><small>{local ? "次の受付で自動で操作画面に戻ります" : "次の行動へ自動で切り替わります"}</small><i className={styles.resultTimer}/>
        </div> : <div className={`${styles.waiting} raid-rps-result`}>
          {pendingCommand && SentHandIcon ? <div className={styles.sentCommand} data-hand={pendingCommand.hand} role="group" aria-label="送信した行動とじゃんけんの手"><SentHandIcon size={32} aria-hidden="true"/><div><small>{sending ? "送信中の内容" : "送信した内容"}</small><b>{pendingCommand.action === "attack" ? "攻撃" : "回復"} / {handName(pendingCommand.hand)}</b></div>{!sending && <Check size={16} aria-hidden="true"/>}</div> : <Monitor size={34}/>}
          <strong>{phase === "sending" ? "送信しています…" : local ? raw?.round.phase === "collecting" ? "送信完了！" : "スクリーンに注目！" : "じゃん・けん・ぽん！"}</strong><span>{local ? raw?.round.phase === "collecting" ? `あと${seconds}秒で、みんな一緒にじゃんけん！` : "全員の攻撃とボスの全体攻撃を見届けよう" : "操作プレビュー：ボスの手を待っています"}</span>{!sentCommand && <div className={styles.waitDots} aria-hidden="true"><i/><i/><i/></div>}
        </div>}
      </div>
      <p className={`${styles.feedback} raid-feedback`} role="status" aria-live="polite">{status}</p>
      {local ? retry || rejoin ? <button type="button" className={styles.confirm} disabled={retry && (!ready || !accepting)} onClick={()=>{ if (rejoin) void join(); else void submit(); }}>{rejoin ? "同期に参加する" : "同じ行動を再送する"}</button> : <div className={`${styles.confirm} ${styles.commandStatus}`} role="status">{(sending || waiting || result) && !ended && <LoaderCircle className={styles.spinner} size={18} aria-hidden="true"/>}<span>{localStatus}</span></div> : <button type="button" className={styles.confirm} disabled={!interactive || busy || ended || joining || Boolean(connectionError) || (ready && !hand)} onClick={() => void submit()}>
        {ended ? <span>戦闘不能</span> : sending || waiting || (local && result) ? <><LoaderCircle className={styles.spinner} size={18}/><span>{sending ? "送信中…" : "次の受付まで待機"}</span></> : result ? <><Check size={19}/><span>まもなく次の行動へ</span></> : <><Radio size={24} aria-hidden="true"/><span className={styles.confirmLabel}><small aria-hidden="true">{production ? "LIVE RAID" : local ? "LOCAL SYNC" : "COMMAND PREVIEW"}</small><strong>{joining ? "参加中…" : local && !accepting ? "受付開始を待っています" : !ready ? "同期に参加する" : !hand ? "じゃんけんの手を選ぼう" : attempt ? "同じ行動を再送する" : local ? "じゃんけんで送信" : "じゃんけんで試す"}</strong></span><ChevronsRight size={24} aria-hidden="true"/></>}
      </button>}
    </section>}
    {local ? <LocalRaidGuide dialogRef={help} screenHref={production ? "/raid/screen" : "/raid/screen?sync=local"}/> : <dialog className={styles.help} ref={help} aria-labelledby="raid-mobile-rules"><header><h2 id="raid-mobile-rules">レイドの遊び方</h2><button type="button" aria-label="レイドのルールを閉じる" onClick={() => help.current?.close()}><X size={20}/></button></header><p>攻撃はボスへ。回復は自分へ。行動とじゃんけんの手を選んで送信しよう。</p><div className={styles.rules}>{Object.values(raidRpsRules).map((rule) => <span key={rule.label}>{rule.label}<b>×{rule.multiplier}</b></span>)}</div><p>操作プレビューです。HP・所持キャラクター・育成値は変わりません。</p><a href="/raid/screen" target="_blank" rel="noreferrer">スクリーンを開く <ArrowUpRight size={15}/></a></dialog>}
  </div>;
}
