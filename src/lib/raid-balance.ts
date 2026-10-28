// Server-owned rules. 10 players normally need around 8–10 mixed-action turns;
// even 20 perfect attacks cannot end a fresh fight in its first round.
export type RaidBalance = { version: 1; participants: number; maxHp: number; attack: number };
export function raidBalance(participants: number): RaidBalance {
  const count = Number.isFinite(participants) ? Math.min(20, Math.max(0, Math.floor(participants))) : 0;
  return {
    version: 1, participants: count,
    maxHp: Math.max(450, count * 450),
    attack: 12 + Math.round(Math.max(0, count - 1) * 5 / 19),
  };
}
