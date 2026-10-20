"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Settings2, X } from "lucide-react";
import { useLocalRaid } from "@/components/battle/use-local-raid";
import type { RaidEntryTarget } from "@/lib/raid-entry";
import { visibleLocalRaid } from "@/lib/local-raid-presentation";
import { emptyRaidPlayback, raidPlaybackReducer, raidScreenScene } from "@/lib/raid-screen-playback";
import { RaidShowcase } from "./raid-showcase";
import styles from "./raid-screen.module.css";

export function RaidScreen({ local = false, canSync = false, entryTargets = [] }: { local?: boolean; canSync?: boolean; entryTargets?: RaidEntryTarget[] }) {
  const { state: live, error, send } = useLocalRaid(local);
  const [playback, dispatch] = useReducer(raidPlaybackReducer, emptyRaidPlayback);
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [reveal, setReveal] = useState<{ roomId: string; turn: number } | null>(null);
  const settings = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (live) dispatch({ type: "snapshot", snapshot: live }); }, [live]);
  const complete = useCallback((id: string) => dispatch({ type: "complete", id }), []);
  const scene = raidScreenScene(playback);
  const active = playback.active;
  const onReveal = useCallback((id: string) => {
    if (active && id === scene.id) setReveal({ roomId: playback.roomId, turn: active.turn });
  }, [active?.turn, scene.id, playback.roomId]);
  useEffect(() => {
    if (!reveal || reveal.roomId !== live?.roomId || reveal.turn <= live.revealedTurn) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const publish = async () => {
      try { await send({ type: "reveal", ...reveal }); }
      catch { if (!cancelled) timer = setTimeout(publish, 500); }
    };
    void publish();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reveal, live?.roomId, live?.revealedTurn, send]);
  const visible = live ? visibleLocalRaid(live) : null;
  const last = visible?.lastResult;
  const members = (visible?.members ?? []).map((member) => member.id === active?.participantId ? { ...member, characterId: active.characterId, characterName: active.characterName } : member);
  const failed = Boolean(visible && visible.participants > 0 && visible.alive === 0 && visible.bossHp > 0 && !active);
  const status = local ? error ? "再接続中" : live ? "ローカル同期中" : "接続中" : "参加受付前";
  const title = failed ? "仲間が全員、戦闘不能に！" : scene.cue === "victory" ? "全員の力で、討伐成功！"
    : active ? `${active.nickname}${scene.cue === "rps" ? "：ボスとじゃんけん！" : scene.cue === "counter" ? "への反撃！" : active.action === "heal" ? "が自分を回復！" : "の攻撃！"}`
      : local ? members.length ? "次の行動をスマホから送ろう" : "スマホから参加しよう！" : "会場レイドスクリーン";
  const message = error || (playback.skipped ? "最新の戦闘状態へ追いつきました。" : last ? `最新結果：${last.nickname}：${last.label} ×${last.multiplier} ／ ${last.action === "attack" ? "攻撃" : "自己回復"} ${last.amount} ／ ボスの反撃 ${last.counterDamage}`
    : local ? "参加QRを読み取って、スマホから攻撃・回復を選ぼう。" : "開催前です。演出は右下の「演出確認ページ」から確認できます。");
  return <>
    <RaidShowcase entryTargets={entryTargets} screen={{ scene, members, local, status, title, message, pending: playback.pending.length, bossName: live?.bossName ?? "キング・アクア", failed,
      onComplete: complete, onReveal, tools: <button type="button" onClick={() => settings.current?.showModal()}><Settings2/>{local ? "同期設定" : "表示設定"}</button> }}/>
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
      <p>{local ? "開発用の簡易同期です。行動ごとの反撃20は操作した本人に適用されます。一斉ラウンド制・管理者認証・報酬保存は後続の実装です。リセットすると参加状況とHPが初期化され、接続中のスマホが参加し直します。" : "参加受付・正式な戦闘進行は準備中です。仮の参加者や行動を実際の戦闘として自動再生しません。"}</p>
      {resetError && <p role="alert">{resetError}</p>}
    </dialog>
  </>;
}
