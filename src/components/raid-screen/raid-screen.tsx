"use client";

import { boss } from "@/lib/boss";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Play, RotateCcw, Settings2, Users, X } from "lucide-react";
import { useLocalRaid } from "@/components/battle/use-local-raid";
import type { RaidEntryTarget } from "@/lib/raid-entry";
import { visibleLocalRaid } from "@/lib/local-raid-presentation";
import { emptyRaidPlayback, raidPlaybackReducer, raidScreenIsLast, raidScreenScene } from "@/lib/raid-screen-playback";
import { useRaidCountdown } from "@/components/battle/use-raid-countdown";
import { RaidShowcase } from "./raid-showcase";
import styles from "./raid-screen.module.css";

export function RaidScreen({ local = false, production = false, canSync = false, entryTargets = [] }: { local?: boolean; production?: boolean; canSync?: boolean; entryTargets?: RaidEntryTarget[] }) {
  const { state: live, error, send } = useLocalRaid(local, false, production ? "/api/raid" : "/api/local-raid");
  const [playback, dispatch] = useReducer(raidPlaybackReducer, emptyRaidPlayback);
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reception, setReception] = useState<{ roomId: string; targets: RaidEntryTarget[] } | null>(null);
  const [entryError, setEntryError] = useState("");
  const [publication, setPublication] = useState<{ roomId: string; turn: number; kind: "reveal" | "action" | "counter" | "finish" } | null>(null);
  const settings = useRef<HTMLDialogElement>(null);
  const roster = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (live?.round.phase !== "lobby") roster.current?.close();
    if (!production || !live || live.round.phase !== "lobby") { setEntryError(""); return; }
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    const roomId = live.roomId;
    const load = async () => {
      try {
        const response = await fetch(`/api/raid/entry?roomId=${roomId}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "参加QRを取得できませんでした。");
        if (!cancelled) { setReception({ roomId, targets: [body.target] }); setEntryError(""); }
      } catch (reason) {
        if (!cancelled) { setEntryError(reason instanceof Error ? reason.message : "参加QRを取得できませんでした。"); timer = setTimeout(load, 2000); }
      }
    };
    void load(); return () => { cancelled = true; clearTimeout(timer); };
  }, [production, live?.roomId, live?.round.phase]);
  useEffect(() => { if (live) dispatch({ type: "snapshot", snapshot: live }); }, [live]);
  const complete = useCallback((id: string) => {
    if (playback.active && id === raidScreenScene(playback).id && raidScreenIsLast(playback)) setPublication({ roomId: playback.roomId, turn: playback.active.turn, kind: "finish" });
    dispatch({ type: "complete", id });
  }, [playback]);
  const seconds = useRaidCountdown(live?.round.closesAt, live?.serverNow);
  const scene = raidScreenScene(playback);
  const active = playback.active;
  const onReveal = useCallback((id: string) => {
    if (active && id === scene.id) setPublication({ roomId: playback.roomId, turn: active.turn, kind: "reveal" });
  }, [active?.turn, scene.id, playback.roomId]);
  const onImpact = useCallback((id: string, kind: "action" | "counter") => {
    if (active && id === scene.id) setPublication({ roomId: playback.roomId, turn: active.turn, kind });
  }, [active?.turn, scene.id, playback.roomId]);
  useEffect(() => {
    if (!publication || publication.roomId !== live?.roomId) return;
    if (publication.kind === "finish" && (live.round.number > publication.turn || live.round.phase !== "playing")) return;
    const cursor = publication.kind === "finish" ? -1 : publication.kind === "reveal" ? live.revealedTurn : publication.kind === "action" ? live.actionTurn : live.counterTurn;
    if (publication.turn <= cursor) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const publish = async () => {
      const { kind, ...target } = publication;
      try { await send(kind === "reveal" || kind === "finish" ? { type: kind, ...target } : { type: "impact", kind, ...target }); }
      catch { if (!cancelled) timer = setTimeout(publish, 500); }
    };
    void publish();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [publication, live?.roomId, live?.revealedTurn, live?.actionTurn, live?.counterTurn, live?.round.number, live?.round.phase, send]);
  const visible = live ? visibleLocalRaid(live) : null;
  const last = visible?.lastResult;
  const members = visible?.members ?? [];
  const failed = Boolean(visible && visible.participants > 0 && visible.alive === 0 && visible.bossHp > 0 && !active);
  const finished = live?.round.phase === "finished";
  const resetBattle = async () => {
    if (!live) return;
    setResetting(true);
    try {
      await send({ type: "reset", ...(production ? { roomId: live.roomId } : {}) });
      setResetError(""); settings.current?.close();
    } catch (reason) { setResetError(reason instanceof Error ? reason.message : "リセットできませんでした。"); }
    finally { setResetting(false); }
  };
  const status = local ? error ? "再接続中" : live ? production ? "会場同期中" : "ローカル同期中" : "接続中" : "参加受付前";
  const title = failed ? "仲間が全員、戦闘不能に！" : scene.cue === "victory" ? "全員の力で、討伐成功！"
    : active ? scene.cue === "rps" ? "みんなでボスとじゃんけん！" : scene.cue === "counter" ? "ボスの全体攻撃！" : "全員の力を合わせよう！"
      : live?.round.phase === "collecting" ? `入力受付 あと${seconds}秒` : live?.round.phase === "lobby" ? "参加者がそろったら受付を開始しよう"
      : local ? members.length ? "次の行動をスマホから送ろう" : "スマホから参加しよう！" : "会場レイドスクリーン";
  const message = error || resetError || entryError || (finished ? "「次のバトルを準備」で参加受付に戻ります。" : live?.round.phase === "collecting" ? `${live.round.submitted} / ${live.round.eligible}人が送信済み。全員同じ「ぽん！」で勝負！` : last ? `ROUND ${last.turn}：全員共通のボスの手で、それぞれの勝敗を判定します。`
    : local ? "参加QRを読み取って、スマホから攻撃・回復を選ぼう。" : "開催前です。演出は右下の「演出確認ページ」から確認できます。");
  return <>
    <RaidShowcase entryTargets={production ? reception && reception.roomId === live?.roomId ? reception.targets : [] : entryTargets} screen={{ admissionOpen: live?.round.phase === "lobby" && (!production || reception?.roomId === live.roomId), scene, members, local, production, status, title, message, pending: 0, bossName: live?.bossName ?? boss.name, bossAttack: live?.bossAttack, failed,
      collection: live?.round.phase === "collecting" ? { round: live.round.number, seconds, submitted: live.round.submitted, eligible: live.round.eligible } : undefined,
      onComplete: complete, onReveal, onImpact, tools: <>{local && (finished ? <button type="button" data-primary disabled={resetting || Boolean(error) || Boolean(removing)} onClick={resetBattle}><RotateCcw/>{resetting ? "準備中…" : "次のバトルを準備"}</button> : <button type="button" data-primary disabled={resetting || Boolean(error) || Boolean(removing) || !live?.alive || live.round.phase !== "lobby"} onClick={async () => {
        if (!live) return;
        setResetting(true); try { await send({ type: "start", roomId: live.roomId }); setResetError(""); }
        catch (reason) { setResetError(reason instanceof Error ? reason.message : "開始できませんでした。"); } finally { setResetting(false); }
      }}><Play/>{live?.round.phase === "collecting" ? "入力受付中" : live?.round.phase === "playing" ? "バトル進行中" : "10秒の入力受付を開始"}</button>)}<button type="button" onClick={() => settings.current?.showModal()}><Settings2/>{local ? "同期設定" : "表示設定"}</button>{local && <button type="button" disabled={!live || live.round.phase !== "lobby" || resetting} onClick={() => roster.current?.showModal()}><Users/>参加者管理</button>}</> }}/>
    <dialog className={styles.settings} ref={roster} aria-labelledby="raid-roster-title" onClick={event => { if (event.target === event.currentTarget) roster.current?.close(); }}>
      <div className={styles.settingsHeading}><h2 id="raid-roster-title">参加者管理</h2><button type="button" aria-label="参加者管理を閉じる" onClick={() => roster.current?.close()}><X/></button></div>
      <p>待機中の参加者 {live?.participants ?? 0} / 20人。解除した人は、このレイドには再参加できません。</p>
      <ul className={styles.waitingRoster}>{members.map(member => <li key={member.id}><div><strong>{member.nickname}</strong><span>{member.characterName}</span></div><button type="button" disabled={Boolean(removing) || resetting || live?.round.phase !== "lobby"} aria-label={member.nickname + "の参加を解除"} onClick={async () => {
        if (!live) return; setRemoving(member.id); setResetError("");
        try { await send({ type: "remove", roomId: live.roomId, participantId: member.id }); }
        catch (reason) { setResetError(reason instanceof Error ? reason.message : "参加を解除できませんでした。"); }
        finally { setRemoving(null); }
      }}>参加解除</button></li>)}</ul>
      {!members.length && <p>参加者はいません。受付QRから参加してください。</p>}
      {resetError && <p role="alert">{resetError}</p>}
    </dialog>
    <dialog className={styles.settings} aria-labelledby="screen-settings-title" ref={settings} onClick={(event) => { if (event.target === event.currentTarget) settings.current?.close(); }}>
      <div className={styles.settingsHeading}><h2 id="screen-settings-title">スクリーンの設定</h2><button type="button" aria-label="表示設定を閉じる" onClick={() => settings.current?.close()}><X/></button></div>
      <p>演出確認ページは独立して残しています。実際の参加人数・HP・行動結果は同期モードで表示します。</p>
      <div className={styles.playback}><a href="/raid/screen?demo=effects">演出確認ページを開く</a>{!local && canSync && <a href="/raid/screen?sync=local">スマホ連携テストへ</a>}
        {production && <a href="/admin/login?next=raid-screen">管理者ログイン</a>}
        {local && <><a href={production ? "/battle/raid" : "/battle/raid?sync=local"} target="_blank" rel="noreferrer">スマホ画面を開く ↗</a><button type="button" disabled={resetting || !live} onClick={resetBattle}>{resetting ? "リセット中…" : "同期をリセット"}</button></>}
      </div>
      <p>{local ? "入力受付は全員共通で10秒、1人1回です。ボスのHPと全体攻撃は参加人数に応じて強くなります。参加できるのは開始前の待機中だけです。開始後はQRを非表示にし、新しい参加は受け付けません。未入力の人は行動せず、反撃は受けます。反撃演出後に次の受付が始まります。リセットで参加状況とHPを初期化します。" : "参加受付・正式な戦闘進行は準備中です。仮の参加者や行動を実際の戦闘として自動再生しません。"}</p>
      {resetError && <p role="alert">{resetError}</p>}
    </dialog>
  </>;
}
