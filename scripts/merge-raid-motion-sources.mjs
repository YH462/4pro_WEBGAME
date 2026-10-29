import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, '3Dmodels/モーション統合');
const folders = ['3Dmodels/モーションファイル', '3Dmodels/モーションファイル2'];
const sources = JSON.parse(await readFile(path.join(root, 'scripts/raid-motion-sources.json'), 'utf8'));
const selections = new Map(sources.flatMap(source => Object.entries(source.import).map(([action, name]) => [name, {
  path: source[action], characterId: source.id, action,
  status: source.inactiveActions?.[action] ?? 'selected',
}])));
const references = {
  'ブシラッコ.glb': 'references/temp-11/unspecified.glb',
  '敵キャラ_デスドラグーン（赤）対戦開始.blend': 'references/des-dragoon/entry.blend',
  '敵キャラ_デスドラグーン（赤）被攻撃.blend': 'references/des-dragoon/hit.blend',
};
for (const [id, prefix] of [['aqua-spirit', '学科モデルC科_ポンタス.blend '], ['temp-08', 'コートロン (1).blend '], ['temp-09', 'デンラコ (1).blend ']]) {
  for (const [action, label] of [['attack', '攻撃'], ['heal', '回復']]) references[`${prefix}${label}.glb`] = `references/${id}/${action}.glb`;
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const unique = new Map(); let inputs = 0;
for (const folder of folders) {
  for (const name of (await readdir(path.join(root, folder), { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name).sort()) {
    const origin = `${folder}/${name}`, bytes = await readFile(path.join(root, origin)), hash = sha256(bytes);
    inputs++;
    if (unique.has(hash)) { unique.get(hash).origins.push(origin); continue; }
    const selection = selections.get(name);
    unique.set(hash, { ...(selection ?? { path: references[name] ?? `references/unassigned/${name}`, status: 'reference' }), sha256: hash, bytes: bytes.length, origins: [origin] });
  }
}
await mkdir(destination, { recursive: true });
for (const record of unique.values()) {
  const target = path.resolve(destination, record.path);
  if (!target.startsWith(destination + path.sep)) throw new Error(`Invalid merged path: ${record.path}`);
  await mkdir(path.dirname(target), { recursive: true });
  try { await copyFile(path.join(root, record.origins[0]), target, constants.COPYFILE_EXCL); }
  catch (error) {
    if (error.code !== 'EEXIST' || sha256(await readFile(target)) !== record.sha256) throw new Error(`Refusing to overwrite a different merged asset: ${record.path}`, { cause: error });
  }
}
const files = [...unique.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
for (const source of sources) for (const action of Object.keys(source.import)) {
  if (!files.some(file => file.path === source[action])) throw new Error(`Missing selected source: ${source.id} ${action}`);
}
await writeFile(path.join(destination, 'inventory.json'), JSON.stringify({ version: 1, inputs, unique: files.length, duplicates: inputs - files.length, files }, null, 2) + '\n');
await writeFile(path.join(destination, 'README.md'), `# モーションの統合管理\n\nゲームへの再出力はこのフォルダを参照します。アップロード元は削除・変更しません。\n\n- 入力 ${inputs} 件 → 内容が異なる ${files.length} 件（完全重複 ${inputs - files.length} 件を統合）。\n- キャラID別の attack / heal が採用原本です。拡張子が特殊だったBlender原本は、内容を変えず .blend 名へ統一しています。\n- references/ は別形式の書き出し・行動不明GLB・未使用のボス演出です。既存の確認済みBlender原本を採用し、別形式GLBは上書きせず保管しています。\n- temp-07/heal.glb は1フレームの静止ポーズだけなので、実行用モーションには登録しません。ゲームの既存回復演出を維持します。\n- flame-dragon/attack.glb は動く対象が表示されない補助オブジェクトだけなので、実行用モーションに登録せず既存の攻撃演出を維持します。\n- inventory.json に各ファイルのSHA-256・元の場所・採用状態を記録しています。\n\n追加取り込み: node scripts/merge-raid-motion-sources.mjs\n再出力: scripts/export-raid-motions.py（Blender）→ node scripts/build-raid-motion-manifest.mjs\n\n採用対象を変えるときは scripts/raid-motion-sources.json を更新します。異なる内容で既存の採用原本を自動上書きすることはありません。詳しくは ../../docs/raid-character-motions.md を参照してください。\n`);
console.log(JSON.stringify({ destination: path.relative(root, destination), inputs, unique: files.length, duplicates: inputs - files.length }));
