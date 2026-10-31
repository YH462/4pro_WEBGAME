import { z } from "zod";

export const hintImageKinds = ["overview", "detail", "map"] as const;
export type HintImageKind = typeof hintImageKinds[number];
export const hintImageLabels: Record<HintImageKind, string> = { overview: "遠くからの写真", detail: "アップの写真", map: "地図" };
export const maxHintImageBytes = 8 * 1024 * 1024;
const imageEdit = z.strictObject({
  action: z.enum(["keep", "replace", "remove"]),
  alt: z.string().trim().max(200, "画像の説明は200文字以内です。").refine(value => !/[\u0000-\u001f\u007f]/.test(value), "画像の説明に制御文字は使用できません。"),
});
export const characterHintEditSchema = z.strictObject({
  location: z.string().trim().max(200, "場所名は200文字以内です。").refine(value => !/[\u0000-\u001f\u007f]/.test(value), "場所名に改行や制御文字は使用できません。").optional(),
  text: z.string().trim().max(1000, "補足テキストは1000文字以内です。").refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "補足テキストに制御文字は使用できません。"),
  revision: z.number().int().min(0),
  images: z.strictObject({ overview: imageEdit, detail: imageEdit, map: imageEdit }),
});
export type CharacterHintEditInput = z.infer<typeof characterHintEditSchema>;
export type SavedHintImage = { id: string; src: string; alt: string; byteLength: number; width: number; height: number };
export type CharacterHintEditorData = {
  characterId: string; location: string; text: string; revision: number; singlePhoto: boolean;
  images: Record<HintImageKind, SavedHintImage | null>;
};
export const characterHintImageUrl = (id: string) => `/api/character-hint-images/${encodeURIComponent(id)}`;
