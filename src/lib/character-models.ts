/** Blender source letters follow the school's department names, independently of element. */
export const characterModels = {
  "forest-golem": { code: "M", department: "機械科", url: "/models/characters/m.glb", yaw: -Math.PI / 2 },
  "thunder-fox": { code: "E", department: "電気情報", url: "/models/characters/e.glb", yaw: Math.PI },
  "flame-dragon": { code: "S", department: "電子制御", url: "/models/characters/s.glb", yaw: -Math.PI / 2 },
  "aqua-spirit": { code: "C", department: "建設システム", url: "/models/characters/c.glb", yaw: 0 },
} satisfies Record<string, { code: string; department: string; url: string; yaw: number }>;

export function characterModel(characterId: string) {
  return Object.hasOwn(characterModels, characterId) ? characterModels[characterId as keyof typeof characterModels] : undefined;
}
