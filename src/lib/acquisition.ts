import { db } from "./db";
import { config } from "./config";
import { HttpError } from "./http-error";
import { tokenHash } from "./tokens";
import { validAcquisitionToken } from "./acquisition-links";
import { characterImageUrl } from "./character-edit-input";
import { departments } from "./master-data";

const departmentIds = departments.map((department) => department.id);
export type AcquisitionResult = { character: { id: string; name: string; element: string; imageUrl?:string|null }; acquired: boolean; departmentCount: number; legend: { id: string; name: string; element: string } | null };

export async function acquisitionTag(token: string) {
  if (!validAcquisitionToken(token)) return null;
  const tag = await db.acquisitionTag.findUnique({ where: { tokenHash: tokenHash(token) }, include: { event: true, character:{include:{department:true}}, department: { include: { character: {include:{department:true}} } } } });
  if (!tag || tag.eventId !== config().EVENT_ID || !tag.enabled || tag.event.status !== "ACTIVE") return null;
  const character=tag.character ?? (tag.departmentId && departmentIds.includes(tag.departmentId) ? tag.department?.character : null);
  if(!character || character.isLegendary) return null;
  return {...tag,character,departmentLabel:character.department?.name??"追加パートナー"};
}

export async function acquireCharacter(playerId: string, token: string): Promise<AcquisitionResult> {
  if (!validAcquisitionToken(token)) throw new HttpError(400, "展示のリンクを確認してください。");
  const eventId = config().EVENT_ID;
  return db.$transaction(async (tx) => {
    // Same lock order as event lifecycle operations; serialize all grants for this player.
    const events = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`;
    if (events[0]?.status !== "ACTIVE") throw new HttpError(409, "現在はキャラクターを獲得できません。");
    const players = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Player" WHERE "id" = ${playerId} AND "eventId" = ${eventId} FOR UPDATE`;
    if (!players.length) throw new HttpError(401, "ゲストとしてはじめてください。");
    const tags = await tx.$queryRaw<{ id: string; departmentId: string|null; characterId:string|null; enabled: boolean }[]>`SELECT "id", "departmentId", "characterId", "enabled" FROM "AcquisitionTag" WHERE "tokenHash" = ${tokenHash(token)} AND "eventId" = ${eventId} FOR SHARE`;
    const tag = tags[0];
    if (!tag?.enabled || (!tag.characterId && (!tag.departmentId || !departmentIds.includes(tag.departmentId)))) throw new HttpError(404, "この展示のリンクは無効です。展示スタッフに確認してください。");
    const character = tag.characterId ? await tx.character.findUnique({where:{id:tag.characterId}}) : await tx.character.findUnique({ where: { departmentId: tag.departmentId! } });
    if (!character || character.isLegendary) throw new HttpError(409, "展示のパートナーを準備しています。");
    const existing = await tx.playerCharacter.findUnique({ where: { playerId_characterId: { playerId, characterId: character.id } } });
    // The unique key also protects against writers outside this acquisition transaction.
    const created = await tx.playerCharacter.createMany({ data: [{ playerId, characterId: character.id }], skipDuplicates: true });
    const acquired = !existing && created.count === 1;
    await tx.acquisitionLog.createMany({ data: [{ playerId, tagId: tag.id, characterId: character.id, granted: acquired }], skipDuplicates: true });
    const owned = await tx.playerCharacter.findMany({ where: { playerId, character: { departmentId: { in: departmentIds }, isLegendary: false } }, select: { characterId: true } });
    let legend: AcquisitionResult["legend"] = null;
    if (owned.length === departmentIds.length) {
      const master = await tx.character.findUnique({ where: { id: "four-pro" } });
      if (!master?.isLegendary) throw new HttpError(409, "4プロの設定を確認中です。時間をおいて再度お試しください。");
      const granted = await tx.playerCharacter.createMany({ data: [{ playerId, characterId: master.id }], skipDuplicates: true });
      if (granted.count) legend = { id: master.id, name: master.name, element: master.element };
    }
    return { character: { id: character.id, name: character.name, element: character.element, imageUrl:characterImageUrl(character.imageId) }, acquired, departmentCount: owned.length, legend };
  });
}
