// Display fixtures only. No admission, combat decisions, or player data are persisted.
// Timings and battle values remain provisional; RPS multipliers are confirmed.
export const raidScreenPreview = {
  bossName: "キング・アクア",
  maxHp: 24000,
  hp: 18540,
  damage: 3680,
  participants: 20,
  turn: 3,
  inputSeconds: 15,
  actions: [
    { id: "attacker", label: "攻撃", english: "ATTACK", total: 12, ready: 9 },
    { id: "healer", label: "自分を回復", english: "SELF HEAL", total: 8, ready: 5 },
  ],
} as const;

export const raidScreenPhases = [
  { id: "command", label: "行動選択", eyebrow: "CHOOSE YOUR ACTION", title: "スマホで行動を選ぼう", message: "仲間と力を合わせて、ボスに挑め！", seconds: 15 },
  { id: "rps", label: "じゃんけん", eyebrow: "ROCK · PAPER · SCISSORS", title: "ボスと、じゃんけん！", message: "攻撃も自分の回復も、じゃんけん結果で効果が変わる！", seconds: 6 },
  { id: "support", label: "自分を回復", eyebrow: "SELF HEAL PHASE", title: "体勢を立て直そう！", message: "回復を選んだ参加者が、それぞれ自分のHPを回復！", seconds: 4 },
  { id: "attack", label: "総攻撃", eyebrow: "ALL-OUT ATTACK", title: "みんなの攻撃が、ひとつに！", message: "じゃんけんの結果を力に。ボスへ一斉攻撃！", seconds: 5 },
  { id: "boss", label: "ボスの攻撃", eyebrow: "BOSS ATTACK", title: "アクアブレスが来る！", message: "ボスの全体攻撃！ 自分のHPに気をつけよう！", seconds: 4 },
  { id: "victory", label: "討伐成功", eyebrow: "RAID COMPLETE", title: "全員の力で、討伐成功！", message: "ご参加ありがとうございました！", seconds: 6 },
] as const;

export type RaidScreenPhase = typeof raidScreenPhases[number]["id"];
