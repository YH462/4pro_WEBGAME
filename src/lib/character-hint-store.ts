import { db } from "./db";
import { HttpError } from "./http-error";
import { characterLocationHint, singlePhotoHint, type LocationHintContent } from "./character-location-hints";
import { characterHintImageUrl, hintImageKinds, hintImageLabels, type CharacterHintEditorData } from "./character-hint-input";
import type { readCharacterHintEdit } from "./character-hint-edit";

const imageMetadata = { id: true, kind: true, alt: true, byteLength: true, width: true, height: true } as const;

export async function getCharacterHintEditorData(characterId: string): Promise<CharacterHintEditorData> {
  const hint = await db.characterLocationHint.findUnique({ where: { characterId }, include: { images: { select: imageMetadata } } });
  const images: CharacterHintEditorData["images"] = { overview: null, detail: null, map: null };
  const singlePhoto = singlePhotoHint(characterId);
  for (const kind of hintImageKinds) {
    if (singlePhoto && kind !== "overview") continue;
    const image = hint?.images.find(image => image.kind === kind);
    if (image) images[kind] = { ...image, src: characterHintImageUrl(image.id) };
  }
  return { characterId, singlePhoto, location: hint?.location ?? "", text: hint?.text ?? "", revision: hint?.revision ?? 0, images };
}

export async function getCharacterLocationHint(character: { id: string; departmentId: string | null }) {
  const saved = await getCharacterHintEditorData(character.id);
  const content: LocationHintContent = { location: saved.location, text: saved.text, ...saved.images };
  return characterLocationHint(character, content);
}

export async function updateCharacterHint(characterId: string, edit: Awaited<ReturnType<typeof readCharacterHintEdit>>) {
  await db.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Character" WHERE "id" = ${characterId} FOR UPDATE`;
    if (!rows.length) throw new HttpError(404, "キャラクターが見つかりません。");
    const previous = await tx.characterLocationHint.findUnique({ where: { characterId }, select: { revision: true } });
    if ((previous?.revision ?? 0) !== edit.input.revision) throw new HttpError(409, "別の画面でヒントが更新されています。再読み込みしてから編集し直してください。");
    const singlePhoto = singlePhotoHint(characterId);
    if (singlePhoto && hintImageKinds.some(kind => kind !== "overview" && edit.input.images[kind].action !== "keep")) throw new HttpError(400, "このキャラのヒントは写真1枚と補足テキストで設定してください。");
    await tx.characterLocationHint.upsert({ where: { characterId }, create: { characterId, location: edit.input.location ?? "", text: edit.input.text, revision: 1 }, update: { ...(edit.input.location !== undefined ? { location: edit.input.location } : {}), text: edit.input.text, revision: { increment: 1 } } });
    for (const kind of hintImageKinds) {
      const change = edit.input.images[kind];
      if (singlePhoto && kind !== "overview" || change.action !== "keep") await tx.characterHintImage.deleteMany({ where: { characterId, kind } });
      if (singlePhoto && kind !== "overview") continue;
      const alt = change.alt || (singlePhoto ? "展示の写真" : hintImageLabels[kind]);
      if (change.action === "replace") {
        const image = edit.images[kind];
        if (!image) throw new HttpError(400, "差し替える画像を選択してください。");
        await tx.characterHintImage.create({ data: { ...image, data: new Uint8Array(image.data), characterId, kind, alt } });
      } else if (change.action === "keep") await tx.characterHintImage.updateMany({ where: { characterId, kind }, data: { alt } });
    }
  }, { timeout: 15_000 });
  return getCharacterHintEditorData(characterId);
}
