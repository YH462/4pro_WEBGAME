"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Expand, Flag, Hand, HandFist, Heart, Maximize, Pause, Play, Radio, RotateCcw, Scissors, Settings2, Shield, Smartphone, Swords, Trophy, Users, Waves, X, Zap } from "lucide-react";
import { ArenaScene } from "@/components/battle/arena-scene";
import { raidScreenPhases as phases, raidScreenPreview as preview, type RaidScreenPhase } from "@/lib/raid-screen-preview";
import { raidRpsRules } from "@/lib/raid-rps";
import { raidHands } from "@/lib/raid-rps";
import { useLocalRaid } from "@/components/battle/use-local-raid";
import styles from "./raid-screen.module.css";

const actionIcons = { attacker: Swords, healer: Heart };
const number = (value: number) => value.toLocaleString("ja-JP");

export function RaidScreen({ local = false }: { local?: boolean }) {
  const [previewPhaseId, setPhaseId] = useState<RaidScreenPhase>("command");
  const { state: live, error: syncError, send } = useLocalRaid(local);
  const [syncActionError, setSyncActionError] = useState("");
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [animationId, setAnimationId] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const settings = useRef<HTMLDialogElement>(null);
  const last = live?.lastResult;
  const phaseId = local ? live?.bossHp === 0 ? "victory" : last && clock - last.at < 4000 ? last.action === "attack" ? "attack" : "support" : "command" : previewPhaseId;
  const phase = phases.find((item) => item.id === phaseId)!;
  const defeated = Boolean(local && live && live.participants > 0 && live.alive === 0 && live.bossHp > 0);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!playing && !local) return;
    setClock(Date.now());
    const timer = window.setInterval(() => { setClock(Date.now()); if (playing) setElapsed((value) => value + 1); }, 500);
    return () => window.clearInterval(timer);
  }, [playing, local]);

  useEffect(() => {
    if (local || !playing || elapsed < phase.seconds * 2) return;
    const next = phases[(phases.findIndex((item) => item.id === phaseId) + 1) % phases.length];
    setPhaseId(next.id);
    setElapsed(0);
  }, [elapsed, phase.seconds, phaseId, playing, local]);

  useEffect(() => {
    if (phaseId === "attack") setAnimationId((value) => value + 1);
  }, [phaseId, local ? last?.id : undefined]);

  function selectPhase(id: RaidScreenPhase) {
    setPlaying(false);
    setElapsed(0);
    setPhaseId(id);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError("");
    } catch {
      setFullscreenError("全画面にできませんでした。ブラウザの全画面表示をお試しください。");
    }
  }

  const command = phaseId === "command";
  const victory = phaseId === "victory";
  const ready = local ? (live?.attackCount ?? 0) + (live?.healCount ?? 0) : command ? Math.min(20, 14 + Math.floor(elapsed / 4)) : 20;
  const hp = local ? live?.bossHp ?? 450 : victory ? 0 : phaseId === "boss" ? preview.hp - preview.damage : preview.hp;
  const maxHp = local ? live?.bossMaxHp ?? 450 : preview.maxHp;
  const participants = local ? live?.participants ?? 0 : preview.participants;
  const alive = local ? live?.alive ?? 0 : 20;
  const turn = local ? live?.turn ?? 1 : preview.turn;
  const seconds = Math.max(0, preview.inputSeconds - Math.floor(elapsed / 2));
  const actionCounts = local ? [
    { id: "attacker" as const, label: "攻撃", english: "ATTACK", total: live?.attackCount ?? 0, ready: live?.attackCount ?? 0 },
    { id: "healer" as const, label: "自分を回復", english: "SELF HEAL", total: live?.healCount ?? 0, ready: live?.healCount ?? 0 },
  ] : preview.actions;
  const title = !local ? phase.title : defeated ? "仲間が全員、戦闘不能に！" : victory ? "全員の力で、討伐成功！" : !live ? "同期サーバーに接続しています" : !participants ? "スマホから参加しよう！" : phaseId === "attack" ? `${last?.nickname} の攻撃！` : phaseId === "support" ? `${last?.nickname} が自己回復！` : "次の行動をスマホから送ろう";
  const message = !local ? phase.message : syncError || (!last ? "スマホの操作と、ボスHP・参加人数・結果が同期します。" : `${last.nickname}：${last.label} ×${last.multiplier} ／ ${last.action === "attack" ? "攻撃" : "自己回復"} ${last.amount} ／ ボスの反撃 ${last.counterDamage}`);
  const resultText = last ? `自分 ${raidHands.find((hand) => hand.id === last.hand)?.label} ／ ボス ${raidHands.find((hand) => hand.id === last.boss)?.label} ／ ${last.label} ×${last.multiplier}` : "";

  return <div className={styles.viewport}>
    <main className={`${styles.screen} ${styles[phaseId]}`} aria-label="会場レイドスクリーン">
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandFour}>4</span><span>PRO<span className={styles.brandCaption}>FOUR DEPARTMENTS. ONE TEAM.</span></span></div>
        <div className={styles.event}><span>KOSEN FESTIVAL / SPECIAL EVENT</span><h1>みんなで挑む、協力レイド。</h1></div>
        <div className={styles.headerRight}><span className={styles.previewBadge}><Radio />{local ? syncError ? "再接続中" : live ? "ローカル同期中" : "接続中" : "UIプレビュー"}</span><strong>RAID BATTLE<span>会場スクリーン</span></strong></div>
      </header>

      <div className={styles.battle}>
        <aside className={styles.allies} aria-label="味方の状況">
          <div className={styles.sectionHeading}><Users /><span>RAID MEMBERS<small>ともに戦う仲間</small></span></div>
          <div className={styles.memberTotal}><strong>{participants}</strong><span>人の<br />挑戦者</span><span className={styles.memberBadge}>全員で協力！</span></div>
          <div className={styles.survivors}><span><i />生存 <strong>{alive}</strong></span><span>戦闘不能 <strong>{participants - alive}</strong></span></div>
          <div className={styles.roles}>{actionCounts.map((role) => {
            const Icon = actionIcons[role.id];
            const roleReady = local ? role.total : command ? Math.min(role.total, role.ready + Math.floor((ready - 14 + (role.id === "attacker" ? 1 : 0)) / 2)) : role.total;
            const denominator = local ? participants : role.total;
            return <div className={`${styles.role} ${styles[role.id]}`} key={role.id}>
              <div className={styles.roleIcon}><Icon /></div><div className={styles.roleName}><span>{role.english}</span><strong>{role.label}</strong></div><strong className={styles.roleCount}>{role.total}<small>人</small></strong>
              <div className={styles.roleProgress}><span style={{ width: `${denominator ? roleReady / denominator * 100 : 0}%` }} /></div><div className={styles.roleReady}><span>{local ? "直近の行動" : command ? "入力済み" : "行動受付完了"}</span><span>{roleReady} / {denominator}<Check /></span></div>
            </div>;
          })}</div>
          <div className={styles.teamNote}><Heart /><p>自分を回復して、<br /><strong>次の一撃につなげよう。</strong></p></div>
        </aside>

        <section className={styles.center} aria-label="ボスとバトル演出">
          <div className={styles.bossHud}>
            <div className={styles.bossTopline}><span><i /> RAID BOSS / 01</span><span className={styles.difficulty}>難易度：中級 <span>◆ ◆ ◇</span></span></div>
            <div className={styles.bossTitle}><h2>{preview.bossName}</h2><span>重装甲の水撃王</span></div>
            <div className={styles.hpLabel}><span>BOSS HP</span><strong>{number(hp)}<small> / {number(maxHp)}</small></strong><span>{Math.ceil(hp / maxHp * 100)}%</span></div>
            <div className={styles.hpTrack} role="progressbar" aria-label="ボスHP" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}><span style={{ width: `${hp / maxHp * 100}%` }} /></div>
          </div>

          <div className={styles.stage}>
            <span className={styles.stageWord} aria-hidden="true">{victory ? "CLEAR" : "RAID"}</span>
            <div className={styles.orbit} aria-hidden="true" /><div className={styles.orbitInner} aria-hidden="true" />
            <div className={styles.arena}><ArenaScene animationId={animationId} caption="" /></div>
            <div className={styles.targetCorner} aria-hidden="true" /><div className={styles.targetCornerEnd} aria-hidden="true" />
            <span className={styles.bossDesignation}>KING AQUA <span>— TARGET 001</span></span>
            {phaseId === "rps" && <div className={styles.phaseOverlay}><span>みんなで、せーの！</span><div className={styles.hands}><HandFist /><Scissors /><Hand /></div><strong>じゃん・けん・ぽん！</strong><div className={styles.rpsRules}>{Object.entries(raidRpsRules).map(([key, rule]) => <span key={key}>{rule.label}<strong>×{rule.multiplier}</strong></span>)}</div><small>演出サンプル：ボスの手は「パー」</small></div>}
            {phaseId === "support" && <div className={`${styles.phaseOverlay} ${styles.supportOverlay}`}><div className={styles.supportIcons}><Heart /></div><strong>{local ? `HP +${last?.amount ?? 0}` : "自分のHPを回復！"}</strong><span>{local ? resultText : "勝ち ×2 ・ あいこ ×1 ・ 負け ×0.5"}</span></div>}
            {phaseId === "attack" && <div className={`${styles.phaseOverlay} ${styles.damageOverlay}`}><span>{local ? "DAMAGE / LIVE SYNC" : "TOTAL DAMAGE"}</span><strong>{number(local ? last?.amount ?? 0 : preview.damage)}</strong><small>{local ? resultText : "みんなの攻撃が命中！"}</small></div>}
            {phaseId === "boss" && <div className={`${styles.phaseOverlay} ${styles.bossOverlay}`}><Waves /><span>全体攻撃</span><strong>アクアブレス</strong></div>}
            {victory && <div className={`${styles.phaseOverlay} ${styles.victoryOverlay}`}><Trophy /><span>BOSS DEFEATED!</span><strong>討伐成功</strong><small>{participants}人の力でつかんだ勝利</small></div>}
            {defeated && <div className={`${styles.phaseOverlay} ${styles.bossOverlay}`}><span>RAID FAILED</span><strong>討伐失敗</strong><small>同期設定からリセットして再挑戦できます</small></div>}
          </div>
          <div className={styles.stageCaption}><span><Flag /> ALL FOR ONE, ONE FOR ALL.</span><span>4学科の力を、ひとつに。</span></div>
        </section>

        <aside className={styles.intel} aria-label={victory ? "討伐結果" : "ボスの行動予告"}>
          <div className={styles.turn}><span>{local ? "ACTION COUNT" : "CURRENT TURN"}</span><strong>{String(turn).padStart(2, "0")}</strong><span>{local ? "1操作ごとの簡易同期テスト" : "力を合わせて、打ち破れ。"}</span></div>
          {victory ? <>
            <div className={`${styles.forecast} ${styles.result}`}>
              <div className={styles.forecastHeading}><Trophy /> RAID RESULT<span>討伐結果</span></div><Trophy /><h2>最高のチームワーク！</h2>
              <p>{alive}人が生存。<br />仲間とつかんだ勝利！</p>
              <dl><div><dt>参加人数</dt><dd>{participants} 人</dd></div><div><dt>生存人数</dt><dd>{alive} 人</dd></div><div><dt>ボス残りHP</dt><dd>0</dd></div></dl>
            </div>
            <div className={styles.bossCondition}><span>BOSS STATUS</span><div><Check />討伐完了 <strong>CLEAR</strong></div></div>
          </> : <>
            <div className={styles.forecast}>
              <div className={styles.forecastHeading}><Zap />{local ? "COUNTER ATTACK" : "NEXT ATTACK"}<span>{local ? "反撃" : "次の攻撃"}</span></div>
              <div className={styles.waveIcon}><Waves /></div><span className={styles.attackType}>{local ? "行動した参加者に反撃" : "味方全体に攻撃"}</span><h2>アクアブレス</h2>
              <p>{local ? <>1操作ごとに<br />自分へ20ダメージ。</> : <>強力な水のブレスが<br />全員に襲いかかる！</>}</p>
              <div className={styles.advice}><Heart /><span>自分のHPを見て<br /><strong>攻撃か回復を選ぼう！</strong></span></div>
            </div>
            <div className={styles.bossCondition}><span>{local ? "LOCAL TEST RULE" : "BOSS STATUS"}</span><div><Shield />{local ? "同期テスト" : "重装甲"}<strong>{local ? "仮の戦闘数値" : "防御力 UP"}</strong></div></div>
          </>}
        </aside>
      </div>

      <footer className={styles.footer}>
        <div className={styles.phaseIcon}>{command ? <Smartphone /> : victory ? <Trophy /> : phaseId === "rps" ? <Hand /> : phaseId === "support" ? <Heart /> : <Swords />}</div>
        <div className={styles.phaseText} aria-live="polite"><span>{local ? "LOCAL RAID / LIVE SYNC" : phase.eyebrow}</span><h2>{title}</h2><p>{message}</p></div>
        {command && !defeated ? <><div className={styles.inputStatus}><div><span>{local ? "行動した人数" : "行動選択済み"}</span><strong>{ready}<small> / {participants} 人</small></strong></div><div className={styles.inputTrack} role="progressbar" aria-label="行動入力状況" aria-valuenow={ready} aria-valuemin={0} aria-valuemax={Math.max(1, participants)}><span style={{ width: `${participants ? ready / participants * 100 : 0}%` }} /></div><span>自分のスマホから操作してください</span></div><div className={styles.timer}><span>{local ? "共有ターン" : "残り時間"}</span><strong>{String(local ? turn : seconds).padStart(2, "0")}{!local && <small>秒</small>}</strong></div></> : <div className={styles.phaseStatus}><span>{victory ? "THANK YOU FOR PLAYING" : "BATTLE IN PROGRESS"}</span><strong>{victory ? "NICE TEAMWORK!" : defeated ? "RETRY!" : "スクリーンに注目！"}</strong></div>}
      </footer>
      <div className={styles.bottomline}><span>FOUR PRO PROJECT <i /> KOSEN FESTIVAL</span><span>{local ? syncError ? "通信切断・再接続中" : "ローカル同期テスト・500msごとに更新" : "表示サンプル・参加受付前"}</span></div>

      <div className={styles.tools}><button type="button" onClick={() => settings.current?.showModal()}><Settings2 />{local ? "同期設定" : "表示設定"}</button><button type="button" aria-label={fullscreen ? "全画面表示を終了" : "全画面で表示"} onClick={toggleFullscreen}>{fullscreen ? <Maximize /> : <Expand />}</button></div>
    </main>

    <dialog className={styles.settings} aria-labelledby="screen-settings-title" ref={settings} onClick={(event) => { if (event.target === event.currentTarget) settings.current?.close(); }}>
      <div className={styles.settingsHeading}><div><span>SCREEN PREVIEW</span><h2 id="screen-settings-title">スクリーンの表示設定</h2></div><button type="button" aria-label="表示設定を閉じる" onClick={() => settings.current?.close()}><X /></button></div>
      {local ? <><p>スマホの行動・じゃんけん結果・ボスHP・参加人数をPCサーバーから同期しています。基本攻撃50、回復30、反撃20はテスト用の仮値です。1操作ずつ即時に反映する簡易進行です。</p><div className={styles.playback}><button type="button" onClick={async () => { try { await send({ type: "reset" }); setSyncActionError(""); settings.current?.close(); } catch (reason) { setSyncActionError(reason instanceof Error ? reason.message : "リセットできませんでした。"); } }}><RotateCcw />同期をリセット</button><a href="/battle/raid?sync=local" target="_blank" rel="noreferrer">スマホ画面を開く ↗</a></div><p>リセットすると全員のHPとボスHPが戻ります。所持キャラ・育成値・報酬は変更しません。ローカル開発用で、正式な管理者認証・一斉ラウンド進行は未実装です。</p>{syncActionError && <p role="alert">{syncActionError}</p>}</> : <><p>表示する場面を選んで、会場での見え方を確認できます。人数・HP・じゃんけんは仮の表示です。</p><div className={styles.phaseButtons}>{phases.map((item, index) => <button type="button" key={item.id} aria-pressed={phaseId === item.id} onClick={() => selectPhase(item.id)}><span>0{index + 1}</span>{item.label}<ChevronRight /></button>)}</div><div className={styles.playback}><button type="button" onClick={() => { setPlaying((value) => !value); settings.current?.close(); }}>{playing ? <Pause /> : <Play />}{playing ? "デモを一時停止" : "デモを自動再生"}</button><button type="button" onClick={() => selectPhase("command")}><RotateCcw />リセット</button></div><p>自動再生は各場面を順番に繰り返します。実際のスマホや管理画面とはまだ連動しません。</p></>}
      {fullscreenError && <p role="alert">{fullscreenError}</p>}
    </dialog>
    {fullscreenError && <div className={styles.error} role="alert">{fullscreenError}</div>}
  </div>;
}
