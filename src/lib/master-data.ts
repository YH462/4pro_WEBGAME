export const departments = [
  { id: "mechanical", name: "機械科", sortOrder: 1 },
  { id: "electrical", name: "電気情報", sortOrder: 2 },
  { id: "control", name: "電子制御", sortOrder: 3 },
  { id: "civil", name: "建設システム", sortOrder: 4 },
];

export const characters = [
  { id: "forest-golem", name: "フォレストゴーレム", description: "森の力と頑丈なからだで仲間を守る、頼れる守護者。", element: "FOREST", departmentId: "mechanical", baseHp: 170, baseAttack: 27, baseDefense: 38, baseSpecialChargeRate: null, baseSpeed: 15, isLegendary: false, sortOrder: 1 },
  { id: "thunder-fox", name: "サンダーフォックス", description: "稲妻のように駆け抜け、ひらめきを力に変える。", element: "THUNDER", departmentId: "electrical", baseHp: 125, baseAttack: 33, baseDefense: 22, baseSpecialChargeRate: null, baseSpeed: 30, isLegendary: false, sortOrder: 2 },
  { id: "flame-dragon", name: "フレイムドラゴン", description: "胸に灯る情熱を翼に乗せて、大空へ羽ばたく。", element: "FLAME", departmentId: "control", baseHp: 120, baseAttack: 40, baseDefense: 20, baseSpecialChargeRate: null, baseSpeed: 25, isLegendary: false, sortOrder: 3 },
  { id: "aqua-spirit", name: "アクアスピリット", description: "澄んだ水の流れを操り、みんなの道を切りひらく。", element: "AQUA", departmentId: "civil", baseHp: 135, baseAttack: 29, baseDefense: 23, baseSpecialChargeRate: null, baseSpeed: 23, isLegendary: false, sortOrder: 4 },
  { id: "four-pro", name: "4プロ", description: "4つの学科の力がひとつになった、伝説のパートナー。", element: "LEGEND", departmentId: null, baseHp: 155, baseAttack: 36, baseDefense: 30, baseSpecialChargeRate: null, baseSpeed: 26, isLegendary: true, sortOrder: 5 },
  // Draft entries for building the 12-character experience. Replace these in place.
  ...[ [145,30,30,25], [130,37,24,30], [180,23,40,20], [115,42,19,35], [155,32,28,25], [140,34,26,30], [160,28,36,20] ].map(([baseHp, baseAttack, baseDefense, baseSpecialChargeRate], index) => ({
    id: `temp-${String(index + 6).padStart(2, "0")}`,
    name: `仮キャラ ${String(index + 6).padStart(2, "0")}`, isDraft:true,
    description: "CPU対戦を試すための仮キャラクターです。名前・見た目・能力値は今後変更します。",
    element: ["FOREST", "THUNDER", "FLAME", "AQUA"][index % 4],
    departmentId: null, baseHp, baseAttack, baseDefense, baseSpecialChargeRate,
    baseSpeed: 1, isLegendary: false, sortOrder: index + 6,
  })),
];

export function isTemporaryCharacter(id: string) { return id.startsWith("temp-"); }
