import { readFile, writeFile } from "node:fs/promises";

// Keep the authored attack geometry, rigs and keys; reuse the blue variant's
// existing embedded textures without editing or recoloring their pixels.
const root = new URL("../public/models/", import.meta.url);
function readGLB(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw new Error("Expected GLB 2");
  const end = 20 + bytes.readUInt32LE(12);
  return { doc: JSON.parse(bytes.subarray(20, end).toString("utf8")), bin: bytes.subarray(end + 8) };
}
const motion = readGLB(await readFile(new URL("motions/des-dragoon-red-attack.glb", root)));
const blue = readGLB(await readFile(new URL("bosses/des-dragoon-blue.glb", root)));
if (JSON.stringify(motion.doc.materials) !== JSON.stringify(blue.doc.materials)
  || JSON.stringify(motion.doc.textures) !== JSON.stringify(blue.doc.textures)) throw new Error("Boss material mappings differ");
const replacements = new Map();
for (const image of motion.doc.images) {
  const matches = blue.doc.images.filter(candidate => candidate.name === image.name && candidate.mimeType === image.mimeType);
  if (matches.length !== 1) throw new Error(`Missing unique blue texture: ${image.name}`);
  const view = blue.doc.bufferViews[matches[0].bufferView];
  replacements.set(image.bufferView, blue.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
}
const chunks = [];
let offset = 0;
for (const [index, view] of motion.doc.bufferViews.entries()) {
  const bytes = replacements.get(index) ?? motion.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  view.byteOffset = offset; view.byteLength = bytes.length;
  const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
  chunks.push(bytes, padding); offset += bytes.length + padding.length;
}
motion.doc.buffers[0].byteLength = offset;
const text = Buffer.from(JSON.stringify(motion.doc));
const json = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
const bin = Buffer.concat(chunks);
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const output = new URL("motions/des-dragoon-blue-attack.glb", root);
await writeFile(output, Buffer.concat([header, json, binHeader, bin]));
console.log(`Created blue boss attack with ${replacements.size} original blue textures.`);
