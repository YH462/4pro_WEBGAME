import { db } from "@/lib/db";
import { api, json } from "@/lib/http";
import { characterModelUrl } from "@/lib/character-models";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () => {
    const characters = await db.character.findMany({ where: { modelId: { not: null } }, select: { id: true, modelId: true, modelYaw: true } });
    return json({ models: Object.fromEntries(characters.map((c) => [c.id, { url: characterModelUrl(c.modelId), yaw: c.modelYaw * Math.PI / 180 }])) });
  });
}
