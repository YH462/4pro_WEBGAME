import { requireAdmin } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { api, checkOrigin, HttpError, json, rateLimit } from "@/lib/http";
import { readCharacterHintEdit } from "@/lib/character-hint-edit";
import { getCharacterHintEditorData, updateCharacterHint } from "@/lib/character-hint-store";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await requireAdmin(); const { id } = await params;
    if (!await db.character.findUnique({ where: { id }, select: { id: true } })) throw new HttpError(404, "キャラクターが見つかりません。");
    return json({ hint: await getCharacterHintEditorData(id) });
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    checkOrigin(request, "multipart/form-data");
    const admin = await requireAdmin(); await rateLimit(`admin-hint:${admin.id}`, 20);
    const { id } = await params;
    return json({ hint: await updateCharacterHint(id, await readCharacterHintEdit(request)) });
  });
}
