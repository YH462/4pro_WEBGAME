import bundled from "./bundled-character-models.json" with { type: "json" };
/** Shared export/seed manifest. Character IDs remain stable when placeholders gain models. */
export type CharacterMotions = Partial<Record<"attack" | "heal", { url: string; yaw: number }>>;
export type CharacterModelAsset = { url: string; yaw: number; motions?: CharacterMotions };
export type CharacterModelCatalog = Record<string, CharacterModelAsset>;
export const maxCharacterModelBytes = 20 * 1024 * 1024;
export const characterModelUrl = (id: string | null | undefined) => id ? `/api/character-models/${encodeURIComponent(id)}` : null;
export const characterModels:Record<string,{code:string;department:string|null;source:string;url:string;yaw:number;displayName?:string}>=Object.fromEntries(bundled.map((asset)=>[asset.id,{code:asset.code,department:asset.department,source:asset.source,url:`/models/characters/${asset.file}`,yaw:asset.yaw*Math.PI/180,...(asset.displayName?{displayName:asset.displayName}:{})}]));

export function characterModel(characterId: string) {
  return Object.hasOwn(characterModels, characterId) ? characterModels[characterId as keyof typeof characterModels] : undefined;
}
