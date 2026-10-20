import type { LocalRaidSnapshot } from "./local-raid-types";

/** Keep result text and HP from giving away hands that the screen has not revealed yet. */
export function visibleLocalRaid(state: LocalRaidSnapshot): LocalRaidSnapshot {
  const mine = state.me?.lastResult;
  const pending = state.results.filter((result) => result.turn > state.counterTurn);
  if (mine && mine.turn > state.counterTurn && !pending.some((result) => result.turn === mine.turn)) pending.unshift(mine);
  const presentedHp = (hp: number, id: string, characterId: string) => {
    // Undo the authoritative effects whose actual screen contact has not happened yet.
    for (const result of pending.toReversed()) {
      if (result.participantId !== id || result.characterId !== characterId) continue;
      if (result.turn > state.counterTurn) hp += result.counterDamage;
      if (result.action === "heal" && result.turn > state.actionTurn) hp -= result.amount;
    }
    return hp;
  };
  const members = state.members.map((member) => {
    return { ...member, hp: presentedHp(member.hp, member.id, member.characterId) };
  });
  const mePending = mine && mine.turn > state.revealedTurn;
  return {
    ...state,
    bossHp: state.results.find((result) => result.turn > state.actionTurn)?.bossHpBefore ?? state.bossHp,
    members,
    alive: members.filter((member) => member.hp > 0).length,
    lastResult: state.results.findLast((result) => result.turn <= state.revealedTurn) ?? null,
    me: state.me ? { ...state.me,
      hp: mine ? presentedHp(state.me.hp, mine.participantId, state.me.characterId) : state.me.hp,
      lastResult: mePending ? state.results.findLast((result) => result.participantId === mine.participantId && result.turn <= state.revealedTurn) ?? null : mine ?? null,
    } : null,
  };
}
