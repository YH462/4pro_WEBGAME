import type { RaidHand } from "./raid-rps";

export type LocalRaidAction = "attack" | "heal";
export type LocalRaidResult = {
  id: string;
  turn: number;
  nickname: string;
  action: LocalRaidAction;
  hand: RaidHand;
  boss: RaidHand;
  outcome: "win" | "draw" | "lose";
  label: string;
  multiplier: number;
  amount: number;
  counterDamage: number;
  at: number;
};

export type LocalRaidMember = {
  characterId: string;
  hp: number;
  maxHp: number;
  lastResult: LocalRaidResult | null;
};

export type LocalRaidSnapshot = {
  roomId: string;
  revision: number;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  turn: number;
  participants: number;
  alive: number;
  attackCount: number;
  healCount: number;
  totalDamage: number;
  totalHealing: number;
  lastResult: LocalRaidResult | null;
  me: LocalRaidMember | null;
};
