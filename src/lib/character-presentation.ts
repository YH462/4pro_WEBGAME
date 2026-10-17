import type { Character, Department, Skill, PlayerCharacter } from "@prisma/client";

type NumericStat = { label: string; base: number; growth: number; value: number };
type ChargeStat = { label: string; base: number | null; growth: number; value: number | null };

export type PartnerView = {
  id: string; name: string; description: string; element: string;
  department: string; departmentId: string | null; isLegendary: boolean; number: number; owned: boolean;
  stats: [NumericStat, NumericStat, NumericStat, ChargeStat];
  skills: { id: string; slot: number; name: string; confirmed: boolean }[];
};
export function presentCharacter(character: Character & { department: Department | null; skills: Skill[] }, owned?: PlayerCharacter): PartnerView {
  const baseStats = [
    { label: "HP", base: character.baseHp, growth: owned?.hpGrowth ?? 0 },
    { label: "攻撃", base: character.baseAttack, growth: owned?.attackGrowth ?? 0 },
    { label: "防御", base: character.baseDefense, growth: owned?.defenseGrowth ?? 0 },
  ];
  const numericStats = baseStats.map((stat) => ({ ...stat, value: stat.base + stat.growth }));
  const chargeBase = character.baseSpecialChargeRate;
  const chargeGrowth = owned?.specialChargeRateGrowth ?? 0;
  const stats: PartnerView["stats"] = [numericStats[0], numericStats[1], numericStats[2], {
    label: "チャージ効率",
    base: chargeBase,
    growth: chargeGrowth,
    value: chargeBase === null ? null : chargeBase + chargeGrowth,
  }];
  return { id: character.id, name: character.name, description: character.description, element: character.element, department: character.department?.name ?? "レジェンド", departmentId: character.departmentId, isLegendary: character.isLegendary, number: character.sortOrder, owned: !!owned, stats, skills: character.skills.map(({ id, slot, name, confirmed }) => ({ id, slot, name, confirmed })) };
}
