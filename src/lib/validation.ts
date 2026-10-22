import { z } from "zod";
export const nicknameSchema = z.object({ nickname: z.string().trim().max(20, "ニックネームは20文字以内で入力してください。").refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "制御文字は使用できません。").optional().default("") }).strict();
