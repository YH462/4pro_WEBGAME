import { z } from "zod";
export const characterElements=["FOREST","THUNDER","FLAME","AQUA","LEGEND"] as const;
export const characterEditSchema=z.strictObject({
  name:z.string().trim().min(1,"名前を入力してください。").max(50,"名前は50文字以内です。").refine((value)=>!/[\u0000-\u001f\u007f]/.test(value),"名前に制御文字は使用できません。"),
  description:z.string().trim().max(1000,"紹介文は1000文字以内です。").refine((value)=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),"紹介文に制御文字は使用できません。"),
  element:z.enum(characterElements),
  baseHp:z.number().int().min(1).max(10000),
  baseAttack:z.number().int().min(1).max(10000),
  baseDefense:z.number().int().min(1).max(10000),
  baseSpecialChargeRate:z.number().int().min(0).max(10000).nullable(),
  isDraft:z.boolean(),
  revision:z.number().int().min(0),
  imageAction:z.enum(["keep","replace","remove"]),
});
export type CharacterEditInput=z.infer<typeof characterEditSchema>;
export const characterImageUrl=(imageId:string|null|undefined)=>imageId?`/api/character-images/${encodeURIComponent(imageId)}`:null;
