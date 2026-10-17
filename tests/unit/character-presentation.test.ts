import { describe, expect, it } from "vitest";
import type { PlayerCharacter } from "@prisma/client";
import { presentCharacter } from "../../src/lib/character-presentation";
import { characters } from "../../src/lib/master-data";

const character = { ...characters[0], baseSpecialChargeRate: null, department: null, skills: [] };
const owned: PlayerCharacter = {
  id: "fixture-owned", playerId: "fixture-player", characterId: character.id,
  acquiredAt: new Date(0), hpGrowth: 17, attackGrowth: 4, defenseGrowth: 2,
  speedGrowth: 999, specialChargeRateGrowth: 5,
};

describe("character stat presentation", () => {
  it("does not convert legacy speed or its growth into special-gauge charge", () => {
    const result = presentCharacter(character, owned);
    expect(result.stats.map((stat) => stat.label)).toEqual(["HP", "攻撃", "防御", "チャージ効率"]);
    expect(result.stats.slice(0, 3).map((stat) => stat.value)).toEqual([187, 31, 40]);
    expect(result.stats[3].value).toBeNull();
  });

  it("uses the independently configured charge rate and its growth", () => {
    expect(presentCharacter({ ...character, baseSpecialChargeRate: 20 }, owned).stats[3].value).toBe(25);
  });

  it("distinguishes a configured zero from an undecided rate", () => {
    expect(presentCharacter({ ...character, baseSpecialChargeRate: 0 }).stats[3].value).toBe(0);
  });
});
