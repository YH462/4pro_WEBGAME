import type { RaidHand } from "./raid-rps";

export type LocalRaidAction = "attack" | "heal";
export type LocalRaidResult = {
  submitted: boolean;
  id: string;
  participantId: string;
  characterId: string;
  characterName: string;
  bossHpBefore: number;
  bossHpAfter: number;
  playerHpBefore: number;
  playerHpAfter: number;
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

export type LocalRaidParticipant = {
  id: string;
  nickname: string;
  characterId: string;
  characterName: string;
  hp: number;
  maxHp: number;
};

export type LocalRaidMember = {
  submission: { round: number; action: LocalRaidAction; hand: RaidHand } | null;
  eligibleRound: number;
  characterId: string;
  hp: number;
  maxHp: number;
  lastResult: LocalRaidResult | null;
};

export type LocalRaidSnapshot = {
  serverNow: number;
  round: { number: number; phase: "lobby" | "collecting" | "playing" | "finished"; closesAt: number | null; submitted: number; eligible: number };
  rounds: LocalRaidRoundResult[];
  roomId: string;
  revision: number;
  revealedTurn: number;
  actionTurn: number;
  counterTurn: number;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossAttack: number;
  difficultyPlayers: number;
  turn: number;
  participants: number;
  removedFromLobby: boolean;
  alive: number;
  attackCount: number;
  healCount: number;
  totalDamage: number;
  totalHealing: number;
  lastResult: LocalRaidResult | null;
  me: LocalRaidMember | null;
  members: LocalRaidParticipant[];
  results: LocalRaidResult[];
};

export type LocalRaidRoundResult = {
  turn: number;
  boss: RaidHand;
  bossHpBefore: number;
  bossHpAfter: number;
  damage: number;
  healing: number;
  results: LocalRaidResult[];
};
