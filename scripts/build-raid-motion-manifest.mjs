import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const sources = JSON.parse(await readFile('scripts/raid-motion-sources.json', 'utf8'));
const models = JSON.parse(await readFile('src/lib/bundled-character-models.json', 'utf8'));
const result = {};
for (const source of sources) {
  const base = models.find(model => model.id === source.id);
  if (!base) continue; // The boss is a separate static asset, not a DB character.
  result[source.id] = {
    baseSha256: createHash('sha256').update(await readFile(`public/models/characters/${base.file}`)).digest('hex'),
    baseYaw: base.yaw,
    motions: Object.fromEntries(['attack', 'heal'].map(action => [action, { url: `/models/motions/${source.file}-${action}.glb`, yaw: 0 }])),
  };
}
await writeFile('src/lib/bundled-character-motions.json', JSON.stringify(result, null, 2) + '\n');
console.log('Generated motion manifest for the six matching bundled models.');
