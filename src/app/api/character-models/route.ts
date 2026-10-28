import { db } from "@/lib/db";
import { api, json } from "@/lib/http";
import { characterModelUrl } from "@/lib/character-models";
import { characterMotionsForModel } from "@/lib/character-motion-catalog";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () => {
    const characters = await db.character.findMany({ where: { modelId: { not: null } }, select: { id: true, modelId: true, modelYaw: true } });
    const entries = await Promise.all(characters.map(async c => [c.id, {
      url: characterModelUrl(c.modelId), yaw: c.modelYaw * Math.PI / 180,
      motions: await characterMotionsForModel(c.id, c.modelId, c.modelYaw),
    }]));
    return json({ models: Object.fromEntries(entries) });
  });
}
