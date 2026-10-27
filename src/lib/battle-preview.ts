import { boss } from "./boss";
// Visual preview values only. The authoritative raid state arrives in phase 5.
// Boss identity is retained from main:battle.html; no combat effects are inferred.
export const battlePreview = {
  bossName: boss.name,
  bossHp: 450,
  initialEp: 30,
  maxEp: 100,
  maxTurns: 10,
  animationMs: 900,
  // Effect amounts are examples for the preview, not final character balance.
  baseAttack: 50,
  baseSelfHeal: 30,
} as const;
