export const raidHands = [
  { id: "rock", label: "グー" },
  { id: "scissors", label: "チョキ" },
  { id: "paper", label: "パー" },
] as const;

export type RaidHand = typeof raidHands[number]["id"];

// The same confirmed multipliers apply to attacks and self-healing.
export const raidRpsRules = {
  win: { label: "勝ち", multiplier: 2 },
  draw: { label: "あいこ", multiplier: 1 },
  lose: { label: "負け", multiplier: 0.5 },
} as const;

const beats: Record<RaidHand, RaidHand> = { rock: "scissors", scissors: "paper", paper: "rock" };

export function resolveRaidRps(player: RaidHand, boss: RaidHand) {
  const outcome: keyof typeof raidRpsRules = player === boss ? "draw" : beats[player] === boss ? "win" : "lose";
  return { outcome, ...raidRpsRules[outcome] };
}
