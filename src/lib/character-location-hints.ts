export type HintImageAsset = { src: string; alt: string };
export type LocationHintContent = {
  location?: string;
  text: string;
  overview?: HintImageAsset | null;
  detail?: HintImageAsset | null;
  map?: HintImageAsset | null;
};
export type CharacterLocationHint = {
  singlePhoto: boolean;
  location: string;
  text: string;
  photos: { kind: "overview" | "detail"; label: string; image: HintImageAsset | null }[];
  map: HintImageAsset | null;
};
// Stable IDs survive locally edited display names, numbering and classifications.
const singlePhotoIds = new Set(["forest-golem", "thunder-fox", "flame-dragon", "aqua-spirit", "four-pro", "temp-12"]);
export const singlePhotoHint = (id: string) => singlePhotoIds.has(id);

export function characterLocationHint(
  character: { id: string; departmentId: string | null },
  entry?: LocationHintContent,
): CharacterLocationHint {
  const singlePhoto = singlePhotoHint(character.id);
  return {
    singlePhoto,
    location: entry?.location?.trim() || "",
    text: entry?.text.trim() || "このキャラクターの場所のヒントは、ただいま準備中です。",
    photos: singlePhoto
      ? [{ kind: "overview", label: "展示の写真", image: entry?.overview ?? null }]
      : [{ kind: "overview", label: "遠くから", image: entry?.overview ?? null }, { kind: "detail", label: "アップ", image: entry?.detail ?? null }],
    map: singlePhoto ? null : entry?.map ?? null,
  };
}
