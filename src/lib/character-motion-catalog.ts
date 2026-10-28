import { createHash } from "node:crypto";
import { db } from "./db";
import manifest from "./bundled-character-motions.json" with { type: "json" };
import type { CharacterMotions } from "./character-models";

const known = manifest as Record<string, { baseSha256: string; baseYaw: number; motions: CharacterMotions }>;
// UUIDs change on replacement. Read each immutable candidate once per process.
const hashes = new Map<string, Promise<string | null>>();
export async function characterMotionsForModel(characterId: string, modelId: string | null, yaw: number): Promise<CharacterMotions | undefined> {
  const entry = Object.hasOwn(known, characterId) ? known[characterId] : undefined;
  if (!entry || !modelId || yaw !== entry.baseYaw) return undefined;
  let pending = hashes.get(modelId);
  if (!pending) {
    pending = db.characterModel.findUnique({ where: { id: modelId }, select: { data: true } })
      .then(model => model ? createHash("sha256").update(model.data).digest("hex") : null)
      .catch(error => { hashes.delete(modelId); throw error; });
    if (hashes.size >= 128) hashes.delete(hashes.keys().next().value!);
    hashes.set(modelId, pending);
  }
  return await pending === entry.baseSha256 ? entry.motions : undefined;
}
