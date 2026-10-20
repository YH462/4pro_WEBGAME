export const showcaseScenes = [
  { id: "idle", label: "待機", seconds: 3, hp: 450, beforeHp: 450 },
  { id: "attack", label: "通常攻撃", seconds: 3, hp: 400, beforeHp: 450 },
  { id: "critical", label: "2倍攻撃", seconds: 4, hp: 300, beforeHp: 400 },
  { id: "heal", label: "自己回復", seconds: 3, hp: 300, beforeHp: 300 },
  { id: "counter", label: "ボスの反撃", seconds: 4, hp: 300, beforeHp: 300 },
  { id: "weaken", label: "ボス弱体", seconds: 3, hp: 90, beforeHp: 90 },
  { id: "victory", label: "討伐成功", seconds: 5, hp: 0, beforeHp: 90 },
] as const;
export type ShowcaseCue = typeof showcaseScenes[number]["id"];
export const showcaseImpactMs = 650;
