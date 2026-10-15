// Visual preview values only. The authoritative raid state arrives in phase 5.
// Boss identity is retained from main:battle.html; no combat effects are inferred.
export const battlePreview = {
  bossName: "キング・アクア",
  bossHp: 450,
  initialEp: 30,
  maxEp: 100,
  maxTurns: 10,
  animationMs: 900,
} as const;
