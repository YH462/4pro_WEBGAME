"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Settings2, X } from "lucide-react";
import { useLocalRaid } from "@/components/battle/use-local-raid";
import type { RaidEntryTarget } from "@/lib/raid-entry";
import { visibleLocalRaid } from "@/lib/local-raid-presentation";
import { emptyRaidPlayback, raidPlaybackReducer, raidScreenIsLast, raidScreenScene } from "@/lib/raid-screen-playback";
import { useRaidCountdown } from "@/components/battle/use-raid-countdown";
import { RaidShowcase } from "./raid-showcase";
import styles from "./raid-screen.module.css";

export function RaidScreen({ local = false, canSync = false, entryTargets = [] }: { local?: boolean; canSync?: boolean; entryTargets?: RaidEntryTarget[] }) {
  const { state: live, error, send } = useLocalRaid(local);
  const [playback, dispatch] = useReducer(raidPlaybackReducer, emptyRaidPlayback);
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [publication, setPublication] = useState<{ roomId: string; turn: number; kind: "reveal" | "action" | "counter" | "finish" } | null>(null);
  const settings = useRef<HTMLDialogElement>(null);
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
  const status = local ? error ? "再接続中" : live ? "ローカル同期中" : "接続中" : "参加受付前";
  const title = failed ? "仲間が全員、戦闘不能に！" : scene.cue === "victory" ? "全員の力で、討伐成功！"
    : active ? scene.cue === "rps" ? "みんなでボスとじゃんけん！" : scene.cue === "counter" ? "ボスの全体攻撃！" : "全員の力を合わせよう！"
      : live?.round.phase === "collecting" ? `入力受付 あと${seconds}秒` : live?.round.phase === "lobby" ? "参加者がそろったら受付を開始しよう"
      : local ? members.length ? "次の行動をスマホから送ろう" : "スマホから参加しよう！" : "会場レイドスクリーン";
  const message = error || resetError || (live?.round.phase === "collecting" ? `${live.round.submitted} / ${live.round.eligible}人が送信済み。全員同じ「ぽん！」で勝負！` : last ? `ROUND ${last.turn}：全員共通のボスの手で、それぞれの勝敗を判定します。`
    : local ? "参加QRを読み取って、スマホから攻撃・回復を選ぼう。" : "開催前です。演出は右下の「演出確認ページ」から確認できます。");
  return <>
    <RaidShowcase entryTargets={entryTargets} screen={{ scene, members, local, status, title, message, pending: 0, bossName: live?.bossName ?? "キング・アクア", failed,
      collection: live?.round.phase === "collecting" ? { round: live.round.number, seconds, submitted: live.round.submitted, eligible: live.round.eligible } : undefined,
      onComplete: complete, onReveal, onImpact, tools: <>{local && live?.round.phase === "lobby" && <button type="button" disabled={resetting || !live.alive} onClick={async () => {
        setResetting(true); try { await send({ type: "start", roomId: live.roomId }); setResetError(""); }
        catch (reason) { setResetError(reason instanceof Error ? reason.message : "開始できませんでした。"); } finally { setResetting(false); }
      }}>10秒の入力受付を開始</button>}<button type="button" onClick={() => settings.current?.showModal()}><Settings2/>{local ? "同期設定" : "表示設定"}</button></> }}/>
    <dialog className={styles.settings} aria-labelledby="screen-settings-title" ref={settings} onClick={(event) => { if (event.target === event.currentTarget) settings.current?.close(); }}>
      <div className={styles.settingsHeading}><h2 id="screen-settings-title">スクリーンの設定</h2><button type="button" aria-label="表示設定を閉じる" onClick={() => settings.current?.close()}><X/></button></div>
      <p>演出確認ページは独立して残しています。実際の参加人数・HP・行動結果は同期モードで表示します。</p>
      <div className={styles.playback}><a href="/raid/screen?demo=effects">演出確認ページを開く</a>{!local && canSync && <a href="/raid/screen?sync=local">スマホ連携テストへ</a>}
        {local && <><a href="/battle/raid?sync=local" target="_blank" rel="noreferrer">スマホ画面を開く ↗</a><button type="button" disabled={resetting} onClick={async () => {
          setResetting(true);
          try { await send({ type: "reset" }); setResetError(""); settings.current?.close(); }
          catch (reason) { setResetError(reason instanceof Error ? reason.message : "リセットできませんでした。"); }
          finally { setResetting(false); }
        }}>{resetting ? "リセット中…" : "同期をリセット"}</button></>}
      </div>
      <p>{local ? "入力受付は全員共通で10秒、1人1回です。全員の行動の後、生存している参加者へ20の全体攻撃を行います。未入力の人は行動せず、途中参加は次のラウンドからです。反撃演出後に次の10秒受付が始まります。リセットで参加状況とHPを初期化します。" : "参加受付・正式な戦闘進行は準備中です。仮の参加者や行動を実際の戦闘として自動再生しません。"}</p>
      {resetError && <p role="alert">{resetError}</p>}
    </dialog>
  </>;
}
