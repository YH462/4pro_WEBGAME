"use client";

import { useEffect, useRef, useState } from "react";
import { Hand, HandFist, Scissors, X } from "lucide-react";
import { battlePreview } from "@/lib/battle-preview";
import { raidHands, raidRpsRules, resolveRaidRps, type RaidHand } from "@/lib/raid-rps";

const handIcons = { rock: HandFist, scissors: Scissors, paper: Hand };
type Result = ReturnType<typeof resolveRaidRps> & { boss: RaidHand };

export function RaidRpsDialog({ action, busy, onClose, onResolve }: {
  action: "attack" | "heal";
  busy: boolean;
  onClose: () => void;
  onResolve: (result: Result) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [hand, setHand] = useState<RaidHand>("rock");
  const [result, setResult] = useState<Result | null>(null);
  const lock = useRef(false);
  const name = action === "attack" ? "攻撃" : "自分を回復";
  const base = action === "attack" ? battlePreview.baseAttack : battlePreview.baseSelfHeal;

  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} className="raid-rps-dialog" aria-labelledby="raid-rps-title" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }}>
    <div className="raid-rps-heading"><div><span>ROCK · PAPER · SCISSORS</span><h2 id="raid-rps-title">{action === "heal" ? "回復" : name}のじゃんけん</h2></div><button type="button" aria-label="じゃんけんを閉じる" disabled={busy} onClick={() => dialog.current?.close()}><X size={18}/></button></div>
    <p>出す手を選ぼう。攻撃・回復に同じ倍率がかかります。</p>
    <div className="raid-rps-rules">{Object.entries(raidRpsRules).map(([key, rule]) => <span key={key}>{rule.label}<strong>×{rule.multiplier}</strong></span>)}</div>
    <div className="raid-rps-hands" role="group" aria-label="じゃんけんの手を選ぶ">{raidHands.map((item) => {
      const Icon = handIcons[item.id];
      return <button type="button" key={item.id} aria-label={`${item.label}を選択`} aria-pressed={hand === item.id} disabled={busy || result !== null} onClick={() => setHand(item.id)}><Icon size={29}/><strong>{item.label}</strong></button>;
    })}</div>
    <div className="raid-rps-result" role="status" aria-live="polite">
      {result ? <><span>自分：{raidHands.find((item) => item.id === hand)!.label} / ボス：{raidHands.find((item) => item.id === result.boss)!.label}</span><strong>{result.label} ×{result.multiplier}</strong><span>{name} {base} × {result.multiplier} = <b>{base * result.multiplier}</b>（効果量の例）</span></> : <><span>ボスの手は、決定後に公開！</span><strong>じゃん・けん・ぽん！</strong><span>{name}：基本量 {base}（仮の数値）</span></>}
    </div>
    <button type="button" className="raid-rps-confirm" disabled={busy} onClick={() => {
      if (busy) return;
      if (result) { setResult(null); lock.current = false; return; }
      if (lock.current) return;
      lock.current = true;
      const boss = raidHands[Math.floor(Math.random() * raidHands.length)].id;
      const next = { boss, ...resolveRaidRps(hand, boss) };
      setResult(next);
      onResolve(next);
    }}>{busy ? "演出中…" : result ? "もう一度試す" : "この手で決定"}</button>
    <p className="raid-rps-note">操作プレビュー：HPは変化しません。実際の戦闘・会場スクリーンとの同期は準備中です。</p>
  </dialog>;
}
