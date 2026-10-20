"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Hand, HandFist, Heart, Radio, Scissors, Swords, UsersRound, X } from "lucide-react";
import type { PartnerView } from "@/lib/character-presentation";
import type { LocalRaidAction, LocalRaidResult, LocalRaidSnapshot } from "@/lib/local-raid-types";
import { visibleLocalRaid } from "@/lib/local-raid-presentation";
import { raidHands, raidRpsRules, type RaidHand } from "@/lib/raid-rps";
import { CharacterArt } from "../character-art";
import { ArenaScene } from "./arena-scene";
import { localRequestId, useLocalRaid } from "./use-local-raid";
import "./battle.css";

const hands = { rock: HandFist, scissors: Scissors, paper: Hand };

function LocalCommandDialog({ action, roomId, revealedTurn, send, onClose }: {
  action: LocalRaidAction; roomId: string; revealedTurn: number;
  send: (input: object) => Promise<{ result?: LocalRaidResult; state: LocalRaidSnapshot }>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [hand, setHand] = useState<RaidHand>("rock");
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [received, setReceived] = useState<LocalRaidResult | null>(null);
  const result = received && received.turn <= revealedTurn ? received : null;
  const waiting = Boolean(received && !result);
  const [error, setError] = useState("");
  const requestId = useRef("");
  const submittedRoom = useRef(roomId);
  const lock = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const name = action === "attack" ? "攻撃" : "自己回復";

  return <dialog className="raid-rps-dialog" ref={dialog} aria-labelledby="local-command-title" onClose={onClose} onCancel={(event) => { if (submitting) event.preventDefault(); }}>
    <div className="raid-rps-heading"><div><span>LOCAL RAID / LIVE SYNC</span><h2 id="local-command-title">{name}のじゃんけん</h2></div><button type="button" aria-label="じゃんけんを閉じる" disabled={submitting} onClick={() => dialog.current?.close()}><X size={18}/></button></div>
    <p>ボスの手・倍率・HPはPCのサーバーが確定します。</p>
    <div className="raid-rps-rules">{Object.entries(raidRpsRules).map(([key, rule]) => <span key={key}>{rule.label}<strong>×{rule.multiplier}</strong></span>)}</div>
    <div className="raid-rps-hands" role="group" aria-label="じゃんけんの手を選ぶ">{raidHands.map((item) => {
      const Icon = hands[item.id];
      return <button type="button" key={item.id} aria-label={`${item.label}を選択`} aria-pressed={hand === item.id} disabled={attempted || submitting || Boolean(result)} onClick={() => setHand(item.id)}><Icon size={29}/><strong>{item.label}</strong></button>;
    })}</div>
    <div className="raid-rps-result" role="status" aria-live="polite">{result ? <><span>自分：{raidHands.find((item) => item.id === hand)!.label} / ボス：{raidHands.find((item) => item.id === result.boss)!.label}</span><strong>{result.label} ×{result.multiplier}</strong><span>{name} {result.amount} ／ ボスの反撃 {result.counterDamage}</span></> : <><span>{submitting ? "サーバーに送信しています…" : waiting ? "送信済み：スクリーンのじゃんけんを待っています" : "ボスの手はスクリーンの「ぽん！」で公開！"}</span><strong>{waiting ? "スクリーンに注目！" : "じゃん・けん・ぽん！"}</strong><span>{waiting ? "順番が来ると結果が表示されます。会場スクリーンを開いてお待ちください。" : "スクリーンと一緒に結果を公開します"}</span></>}</div>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="raid-rps-confirm" disabled={submitting || waiting} onClick={async () => {
      if (lock.current) return;
      if (result) { dialog.current?.close(); return; }
      lock.current = true;
      setSubmitting(true); setAttempted(true); setError("");
      try {
        requestId.current ||= localRequestId();
        const response = await send({ type: "command", roomId: submittedRoom.current, requestId: requestId.current, action, hand });
        if (!response.result) throw new Error("結果を取得できませんでした。再送してください。");
        setReceived(response.result);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "送信に失敗しました。再送してください。"); }
      finally { setSubmitting(false); lock.current = false; }
    }}>{submitting ? "送信中…" : waiting ? "スクリーンで公開待ち…" : result ? "閉じて続ける" : attempted ? "同じ行動を再送する" : "この手で送信"}</button>
    <p className="raid-rps-note">同期テストの仮ルール：基本攻撃50・回復30、1操作ごとに自分へ反撃20。回復は最大HPが上限です。</p>
  </dialog>;
}

export function LocalBattleConsole({ partners }: { partners: PartnerView[] }) {
  const { state: rawState, error, send } = useLocalRaid(true, true);
  const state = rawState ? visibleLocalRaid(rawState) : null;
  const waiting = Boolean(rawState?.me?.lastResult && rawState.me.lastResult.turn > rawState.revealedTurn);
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [action, setAction] = useState<LocalRaidAction>("attack");
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [animationId, setAnimationId] = useState(0);
  const [busy, setBusy] = useState(false);
  const joined = useRef("");
  const lastAnimation = useRef("");
  const partner = partners.find((item) => item.id === partnerId) ?? partners[0];
  useEffect(() => { setOpen(false); }, [state?.roomId]);

  const join = useCallback(async () => {
    setJoining(true); setJoinError("");
    try { await send({ type: "join", characterId: partnerId }); }
    catch (reason) { setJoinError(reason instanceof Error ? reason.message : "参加に失敗しました。"); }
    finally { setJoining(false); }
  }, [send, partnerId]);
  useEffect(() => {
    if (!state || !partnerId || state.me?.characterId === partnerId) return;
    const key = `${state.roomId}:${partnerId}`;
    if (joined.current === key) return;
    joined.current = key;
    void join();
    // Rejoin once per room/character; failed joins can be retried with the main button.
  }, [state?.roomId, state?.me?.characterId, partnerId, join]);

  useEffect(() => {
    const result = state?.me?.lastResult;
    if (!result) { lastAnimation.current = ""; setBusy(false); return; }
    if (lastAnimation.current === result.id) return;
    lastAnimation.current = result.id;
    if (result.action === "attack") setAnimationId((value) => value + 1);
    setBusy(true);
    const timer = setTimeout(() => setBusy(false), 1400);
    return () => clearTimeout(timer);
  }, [state?.me?.lastResult?.id]);

  if (!partner) return <div className="empty-panel">キャラクター情報を準備しています。</div>;
  const me = state?.me;
  const maxHp = me?.maxHp ?? partner.stats[0].value;
  const hp = me?.hp ?? maxHp;
  const result = me?.lastResult;
  const ended = Boolean(state && (state.bossHp <= 0 || hp <= 0));
  const ready = Boolean(state && me && me.characterId === partnerId && !error && !joining);
  const status = error || joinError || (joining ? "ローカルレイドへ参加しています…" : !state ? "同期サーバーに接続しています…" : !me ? "下のボタンから同期に参加してください。" : waiting ? "スクリーンのじゃんけんを待っています。会場スクリーンに注目！" : state.bossHp <= 0 ? "討伐成功！ スクリーンの同期設定から再戦できます。" : hp <= 0 ? "戦闘不能です。スクリーンの同期設定から再戦できます。" : result ? `${result.label} ×${result.multiplier}：${result.action === "attack" ? "攻撃" : "自己回復"} ${result.amount} ／ 反撃 ${result.counterDamage}` : "接続済み。攻撃・回復を選んでスクリーンへ送信！");

  return <div className="raid-console">
    <section className={`enemy-field ${busy && result?.action === "attack" ? "is-attacking" : ""}`} aria-label="敵画面">
      <div className="enemy-hud"><div className="boss-status"><span className="boss-type"><span className="signal-dot"/> LOCAL RAID / LIVE</span><h2>{state?.bossName ?? "キング・アクア"}</h2><div className="boss-health-label"><span>HP</span><strong>{state?.bossHp ?? "—"}<small> / {state?.bossMaxHp ?? "—"}</small></strong></div><div className="boss-health" role="progressbar" aria-label="ボスHP（同期）" aria-valuemin={0} aria-valuemax={state?.bossMaxHp ?? 450} aria-valuenow={state?.bossHp ?? 450}><span style={{ width: `${state ? state.bossHp / state.bossMaxHp * 100 : 100}%` }}/></div></div><div className="raid-turn"><span>TURN</span><strong>{String(state?.turn ?? 1).padStart(2, "0")}</strong><span className="raid-waiting">{error ? "再接続中" : "同期テスト"}</span></div></div>
      <div className="enemy-viewport"><ArenaScene animationId={animationId} caption="LOCAL RAID / LIVE SYNC"/><div className="attack-beam" aria-hidden="true"/></div>
      <div className="enemy-bottom"><span><UsersRound size={13}/>参加人数 <strong>{state?.participants ?? "—"} / 20</strong></span><span><Radio size={11}/>{error ? "接続を確認してください" : "PCサーバーと同期中"}</span><a href="/raid/screen?sync=local" target="_blank" rel="noreferrer">スクリーンを開く ↗</a></div>
    </section>
    <section className="raid-controls" aria-label="スマホ操作画面">
      <div className="player-hud"><span className={`player-portrait element-${partner.element.toLowerCase()}`}><CharacterArt element={partner.element} locked={!partner.owned}/>{busy && result?.action === "heal" && <Heart className="healing-preview" aria-label="自分を回復する演出"/>}</span><div className="player-vitals"><div className="player-select"><label className="sr-only" htmlFor="local-battle-partner">参加キャラクター</label><select id="local-battle-partner" value={partner.id} disabled={joining || open || busy || waiting} onChange={(event) => setPartnerId(event.target.value)}>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}{item.owned ? "" : "（体験）"}</option>)}</select><ChevronDown size={13}/></div><div className="player-health"><span>HP</span><div role="progressbar" aria-label="自分のHP（同期）" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}><span style={{ width: `${hp / maxHp * 100}%` }}/></div><strong>{hp}<small> / {maxHp}</small></strong></div></div><div className="player-rps-rules" aria-label="じゃんけんの倍率">{Object.entries(raidRpsRules).map(([key, rule]) => <span key={key}>{rule.label}<strong>×{rule.multiplier}</strong></span>)}</div></div>
      <div className="raid-skills" role="group" aria-label="行動を選ぶ">{([{ id: "attack", name: "攻撃", description: "ボスを攻撃する", icon: Swords }, { id: "heal", name: "回復", description: "自分のHPを回復する", icon: Heart }] as const).map((item, index) => {
        const Icon = item.icon;
        return <button type="button" key={item.id} className={`raid-skill ${action === item.id ? "chosen" : ""}`} aria-label={`${item.name}を選択`} aria-pressed={action === item.id} disabled={!ready || ended || busy || waiting} onClick={() => setAction(item.id)}><span className="skill-topline"><span>0{index + 1}</span>{action === item.id && <Check size={12}/>}</span><Icon className="skill-symbol" size={24}/><strong>{item.name}</strong><span className="skill-bottomline">{item.description}</span></button>;
      })}</div>
      <p className="raid-feedback" role="status" aria-live="polite">{status}</p>
      <button type="button" className="raid-confirm" disabled={!state || Boolean(error) || joining || ended || busy || waiting} onClick={() => { if (!ready) void join(); else setOpen(true); }}><span className="confirm-selection"><span>LOCAL SYNC</span><strong>{action === "attack" ? "攻撃" : "自己回復"}</strong></span><span className="confirm-action">{joining ? "参加中…" : !ready ? "同期に参加する" : waiting ? "公開待ち…" : busy ? "演出中…" : "じゃんけんで送信"}<Hand size={23}/></span></button>
    </section>
    {open && state && <LocalCommandDialog action={action} roomId={state.roomId} revealedTurn={state.revealedTurn} send={send} onClose={() => setOpen(false)}/>}
  </div>;
}
