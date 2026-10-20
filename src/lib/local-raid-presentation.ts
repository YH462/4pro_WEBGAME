import type { LocalRaidSnapshot } from "./local-raid-types";

/** Keep result text and HP from giving away hands that the screen has not revealed yet. */
export function visibleLocalRaid(state: LocalRaidSnapshot): LocalRaidSnapshot {
  const pending = state.results.filter((result) => result.turn > state.revealedTurn);
  const members = state.members.map((member) => {
    const first = pending.find((result) => result.participantId === member.id && result.characterId === member.characterId);
    return first ? { ...member, hp: first.playerHpBefore } : member;
  });
  const mine = state.me?.lastResult;
  const mePending = mine && mine.turn > state.revealedTurn;
  const firstMine = mePending ? pending.find((result) => result.participantId === mine.participantId) ?? mine : null;
  return {
    ...state,
    bossHp: pending[0]?.bossHpBefore ?? state.bossHp,
    members,
    alive: members.filter((member) => member.hp > 0).length,
    lastResult: state.results.findLast((result) => result.turn <= state.revealedTurn) ?? null,
    me: state.me ? { ...state.me,
      hp: firstMine && firstMine.characterId === state.me.characterId ? firstMine.playerHpBefore : state.me.hp,
      lastResult: mePending ? state.results.findLast((result) => result.participantId === mine.participantId && result.turn <= state.revealedTurn) ?? null : mine ?? null,
    } : null,
  };
}
