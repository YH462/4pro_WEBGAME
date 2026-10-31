import sharp from "sharp";
import { HttpError } from "./http-error";
import { maxHintImageBytes, type HintImageKind } from "./character-hint-input";

export async function optimizeHintImage(file: File, kind: HintImageKind) {
  if (!file.size) throw new HttpError(400, "画像を選択してください。");
  if (file.size > maxHintImageBytes) throw new HttpError(413, "画像は1枚8MB以内で選択してください。");
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!formats[file.type]) throw new HttpError(415, "静止画のJPEG・PNG・WebPを選択してください。");
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const input = { limitInputPixels: 64_000_000 };
    const metadata = await sharp(bytes, input).metadata();
    if (metadata.format !== formats[file.type] || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) throw new Error("Invalid image");
    const map = kind === "map";
    const { data, info } = await sharp(bytes, input).rotate()
      .resize({ width: map ? 2400 : 1600, height: map ? 1600 : 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: map ? 86 : 78, alphaQuality: 85 }).toBuffer({ resolveWithObject: true });
    return { data, byteLength: data.length, width: info.width, height: info.height };
  } catch { throw new HttpError(400, "画像を読み込めません。静止画のJPEG・PNG・WebP（6400万画素以内）を選択してください。"); }
}
