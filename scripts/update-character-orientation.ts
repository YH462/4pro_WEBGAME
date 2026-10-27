import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "../src/lib/db";
import { readCharacterEdit, updateCharacter } from "../src/lib/character-edit";

// Explicit one-off upgrade, never part of seed/migrate/startup. Refuse to
// overwrite any staff replacement or facing adjustment made since these files.
const targets = [
  { id: "temp-09", file: "denrako.glb", oldHash: "83d69e7fa8dd7c6bd1b056fdbba2758cae9622c1ee79ae464f38f40e09bb1e80" },
  { id: "temp-11", file: "bushirakko.glb", oldHash: "26e3adc8dac4188602538f143eb80e9361ea05d0437bac354c9964d0b8f3e476" },
];
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const apply = process.argv.includes("--apply");
try {
  const plans = [];
  for (const target of targets) {
    const character = await db.character.findUniqueOrThrow({ where: { id: target.id }, include: { model: true, image: true } });
    const data = await readFile(resolve("public/models/characters", target.file));
    if (character.model && hash(character.model.data) === hash(data) && character.modelYaw === 0) {
      console.log(`${character.name}: already updated`);
      continue;
    }
    if (!character.model || hash(character.model.data) !== target.oldHash || character.modelYaw !== -90) {
      throw new Error(`${character.name}: custom/unknown model or facing; no automatic replacement. Use the admin preview instead.`);
    }
    const image = await readFile(resolve("public/models/characters", target.file.replace(/\.glb$/, ".webp")));
    const form = new FormData();
    const { name, description, element, baseHp, baseAttack, baseDefense, baseSpecialChargeRate, isDraft, revision } = character;
    form.set("data", JSON.stringify({ name, description, element, baseHp, baseAttack, baseDefense, baseSpecialChargeRate, isDraft, revision, imageAction: "replace", modelAction: "replace", modelYaw: 0 }));
    form.set("model", new Blob([new Uint8Array(data)]), target.file);
    form.set("image", new Blob([new Uint8Array(image)], { type: "image/webp" }), target.file.replace(/\.glb$/, ".webp"));
    const edit = await readCharacterEdit(new Request("http://localhost/model-upgrade", { method: "POST", body: form }));
    plans.push({ target, character, edit });
    console.log(`${character.name}: validated; replace legacy GLB and portrait, facing -90 -> 0`);
  }
  if (!apply) {
    console.log("Dry run only. Add --apply to update this DATABASE_URL.");
  } else if (plans.length) {
    const backup = resolve(".local/model-orientation-backups", new Date().toISOString().replace(/[:.]/g, "-"));
    await mkdir(backup, { recursive: true });
    for (const { target, character } of plans) {
      await writeFile(resolve(backup, target.file), character.model!.data);
      if (character.image) await writeFile(resolve(backup, `${target.id}.webp`), character.image.data);
    }
    await writeFile(resolve(backup, "previous.json"), JSON.stringify(plans.map(({ character: c }) => ({ id: c.id, name: c.name, modelId: c.modelId, imageId: c.imageId, modelYaw: c.modelYaw, revision: c.revision })), null, 2));
    console.log(`Original model/portrait backup: ${backup}`);
    for (const { target, edit } of plans) {
      // Same validated, revision-checked transaction as an admin upload.
      const result = await updateCharacter(target.id, edit);
      console.log(`${result.name}: updated (${result.modelId}), facing ${result.modelYaw}`);
    }
  }
} finally { await db.$disconnect(); }
