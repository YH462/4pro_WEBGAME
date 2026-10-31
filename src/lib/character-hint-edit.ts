import { HttpError } from "./http-error";
import { characterHintEditSchema, hintImageKinds, maxHintImageBytes, type HintImageKind } from "./character-hint-input";
import { optimizeHintImage } from "./character-hint-image";

export async function readCharacterHintEdit(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "入力がありません。");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 3 * maxHintImageBytes + 32_768) { await reader.cancel(); throw new HttpError(413, "画像は1枚8MB以内で選択してください。"); }
    chunks.push(value);
  }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new HttpError(400, "送信形式を確認してください。"); }
  const allowed: readonly string[] = ["data", ...hintImageKinds];
  if ([...form.keys()].some(key => !allowed.includes(key)) || allowed.some(key => form.getAll(key).length > 1)) throw new HttpError(400, "入力項目を確認してください。");
  const data = form.get("data");
  if (typeof data !== "string" || Buffer.byteLength(data) > 12_000) throw new HttpError(400, "入力内容を確認してください。");
  let raw: unknown; try { raw = JSON.parse(data); } catch { throw new HttpError(400, "入力形式を確認してください。"); }
  const input = characterHintEditSchema.parse(raw);
  const images: Partial<Record<HintImageKind, Awaited<ReturnType<typeof optimizeHintImage>>>> = {};
  for (const kind of hintImageKinds) {
    const file = form.get(kind);
    if (input.images[kind].action === "replace") {
      if (!file || typeof file === "string") throw new HttpError(400, "差し替える画像を選択してください。");
      images[kind] = await optimizeHintImage(file, kind);
    } else if (file) throw new HttpError(400, "画像の変更方法を確認してください。");
  }
  return { input, images };
}
