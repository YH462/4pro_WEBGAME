import type { Character, Department, Skill, PlayerCharacter } from "@prisma/client";

export type PartnerView = {
  id: string; name: string; description: string; element: string;
  department: string; isLegendary: boolean; number: number; owned: boolean;
  stats: { label: string; base: number; growth: number; value: number }[];
  skills: { id: string; slot: number; name: string; confirmed: boolean }[];
};
export function presentCharacter(character: Character & { department: Department | null; skills: Skill[] }, owned?: PlayerCharacter): PartnerView {
  const stats = [
    { label: "HP", base: character.baseHp, growth: owned?.hpGrowth ?? 0 },
    { label: "攻撃", base: character.baseAttack, growth: owned?.attackGrowth ?? 0 },
    { label: "防御", base: character.baseDefense, growth: owned?.defenseGrowth ?? 0 },
    { label: "速さ", base: character.baseSpeed, growth: owned?.speedGrowth ?? 0 },
  ];
  return { id: character.id, name: character.name, description: character.description, element: character.element, department: character.department?.name ?? "レジェンド", isLegendary: character.isLegendary, number: character.sortOrder, owned: !!owned, stats: stats.map((stat) => ({ ...stat, value: stat.base + stat.growth })), skills: character.skills.map(({ id, slot, name, confirmed }) => ({ id, slot, name, confirmed })) };
}
