import { boss } from "./boss";
import type { PartnerView } from "./character-presentation";

// Temporary CPU practice balance. Keep separate from the exhibition raid rules.
export const cpuRules = {
  maxEp: 100, initialEp: 0, specialCost: 100, specialMultiplier: 2.4,
  defenseFactor: .35, guardMultiplier: .35, fallbackCharge: 25,
  guardChargeBonus: 25, openingMultiplier: 1.5,
  maxTurns: 30, actionDelayMs: 600,
} as const;

export type CpuAction = "attack" | "defend" | "special";
export type Fighter = { id: string; name: string; maxHp: number; attack: number; defense: number; charge: number };
export const trainingCpu: Fighter = { id: "training-cpu", name: boss.name, maxHp: 180, attack: 30, defense: 20, charge: 50 };
export type CpuBattle = {
  player: Fighter; cpu: Fighter; playerHp: number; cpuHp: number;
  playerEp: number; cpuEp: number; turn: number;
  cpuOpening: boolean;
  result: "playing" | "win" | "lose" | "draw";
  lastTurn: { playerAction: CpuAction; cpuAction: CpuAction; damageToCpu: number; damageToPlayer: number } | null;
};

export function practiceFighter(partner: PartnerView): Fighter {
  return { id: partner.id, name: partner.name, maxHp: partner.stats[0].value,
    attack: partner.stats[1].value, defense: partner.stats[2].value,
    charge: partner.stats[3].value ?? cpuRules.fallbackCharge };
}
export function createCpuBattle(player: Fighter, cpu: Fighter = trainingCpu): CpuBattle {
  return { player: { ...player }, cpu: { ...cpu }, playerHp: player.maxHp, cpuHp: cpu.maxHp,
    playerEp: cpuRules.initialEp, cpuEp: cpuRules.initialEp, turn: 0, cpuOpening: false, result: "playing", lastTurn: null };
}
// Decide before the player chooses. The forecast and resolution use this same rule.
export function chooseCpuAction(state: CpuBattle): CpuAction {
  if (state.cpuEp >= cpuRules.specialCost) return "special";
  if (state.cpuOpening) return "attack";
  return state.turn % 3 === 1 ? "defend" : "attack";
}
export function damage(attacker: Fighter, defender: Fighter, action: CpuAction, guarded: boolean): number {
  if (action === "defend") return 0;
  const raw = Math.max(1, Math.round(attacker.attack * (action === "special" ? cpuRules.specialMultiplier : 1) - defender.defense * cpuRules.defenseFactor));
  return guarded ? Math.max(1, Math.round(raw * cpuRules.guardMultiplier)) : raw;
}
export function resolveCpuTurn(state: CpuBattle, playerAction: CpuAction): CpuBattle {
  if (state.result !== "playing" || (playerAction === "special" && state.playerEp < cpuRules.specialCost)) return state;
  const cpuMove = chooseCpuAction(state);
  const damageToCpu = Math.round(damage(state.player, state.cpu, playerAction, cpuMove === "defend") * (state.cpuOpening ? cpuRules.openingMultiplier : 1));
  const damageToPlayer = damage(state.cpu, state.player, cpuMove, playerAction === "defend");
  const playerHp = Math.max(0, state.playerHp - damageToPlayer);
  const cpuHp = Math.max(0, state.cpuHp - damageToCpu);
  const turn = state.turn + 1;
  const nextEp = (ep: number, action: CpuAction, charge: number) => action === "special"
    ? Math.max(0, ep - cpuRules.specialCost) : Math.min(cpuRules.maxEp, ep + Math.max(0, charge));
  const guardBonus = playerAction === "defend" && damageToPlayer > 0 ? cpuRules.guardChargeBonus : 0;
  return { ...state, playerHp, cpuHp, turn, cpuOpening: cpuMove === "special",
    playerEp: Math.min(cpuRules.maxEp, nextEp(state.playerEp, playerAction, state.player.charge) + guardBonus),
    cpuEp: nextEp(state.cpuEp, cpuMove, state.cpu.charge),
    result: playerHp === 0 && cpuHp === 0 ? "draw" : cpuHp === 0 ? "win" : playerHp === 0 ? "lose" : turn >= cpuRules.maxTurns ? "draw" : "playing",
    lastTurn: { playerAction, cpuAction: cpuMove, damageToCpu, damageToPlayer },
  };
}
