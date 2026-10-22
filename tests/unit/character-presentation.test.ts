import { describe, expect, it } from "vitest";
import type { PlayerCharacter, Skill } from "@prisma/client";
import { presentCharacter } from "../../src/lib/character-presentation";
import { characters } from "../../src/lib/master-data";

const character = { ...characters[0], isDraft:false, imageId:null,revision:0,baseSpecialChargeRate: null, department: null, skills: [] };
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

describe("single special move presentation", () => {
  const first: Skill = { id: "move-1", characterId: character.id, slot: 1, name: "旧固有技1", confirmed: false, effect: null };
  const legacy = { ...first, id: "move-2", slot: 2, name: "旧固有技2", confirmed: true };

  it("uses only slot one even when legacy skills arrive first", () => {
    expect(presentCharacter({ ...character, skills: [legacy, first] }).specialMove).toEqual({ id: first.id, name: "必殺技", confirmed: false });
  });

  it("keeps the confirmed special move name", () => {
    expect(presentCharacter({ ...character, skills: [{ ...first, name: "確定済みの必殺技", confirmed: true }] }).specialMove?.name).toBe("確定済みの必殺技");
  });

  it("does not substitute a legacy skill when the special move is absent", () => {
    expect(presentCharacter({ ...character, skills: [legacy] }).specialMove).toBeNull();
  });
});
